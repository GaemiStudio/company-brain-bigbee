import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BrainMessage as BrainMessageRow } from '@prisma/client';
import { BrainMessage, BrainMessageKind, BrainMessageList } from '@app-starter/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BrainAccessService } from './brain-access.service';
import { BrainSettingsService } from './brain-settings.service';
import { classifyMessage } from './classify-message';
import { embedText, toVectorLiteral, warmUpEmbeddings } from './embedding';
import { CreateBrainMessageDto } from './dto/create-brain-message.dto';

/** The closest existing cluster to a new message, and how close it is (0–1). */
interface NearestCluster {
  id: string;
  similarity: number;
}

/**
 * The "cutter": refines each chat message into something the brain can count.
 *
 * For every message it:
 *   1. classifies it as problem / success / neither (keyword rules)
 *   2. turns it into a 384-number meaning vector (local model)
 *   3. puts it in the closest cluster of the same kind, or starts a new one
 *
 * Triggerware then watches the clusters through database views; nothing
 * here decides when an alert fires.
 *
 * Every query is scoped by organizationId. Vector columns can't be read or
 * written by Prisma's normal API, so those statements use raw SQL.
 */
@Injectable()
export class MessagesService implements OnModuleInit {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrainAccessService,
    private readonly settings: BrainSettingsService,
  ) {}

  /** Load the embedding model in the background so the first message isn't slow. */
  onModuleInit(): void {
    warmUpEmbeddings()
      .then(() => this.logger.log('Embedding model loaded'))
      .catch((error: unknown) => this.logger.error(`Embedding model failed to load: ${error}`));
  }

  /** Post a message typed by a signed-in member (the live input box). */
  async create(
    userId: string,
    organizationId: string,
    data: CreateBrainMessageDto,
  ): Promise<BrainMessage> {
    await this.access.requireMember(userId, organizationId, 'post messages');
    return this.record(organizationId, data.authorName, data.text);
  }

  async list(userId: string, organizationId: string): Promise<BrainMessageList> {
    await this.access.requireMember(userId, organizationId, 'view messages');

    const messages = await this.prisma.brainMessage.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });

    return { items: messages.map((message) => this.toResponse(message)), total: messages.length };
  }

  /**
   * Classify, embed, cluster and save one message. No role check: callers
   * (create above, and the simulation) have already checked access.
   */
  async record(organizationId: string, authorName: string, text: string): Promise<BrainMessage> {
    const kind = classifyMessage(text);

    // Messages that are neither a problem nor a success are kept for the
    // channel view, but don't join any cluster.
    if (kind === 'neither') {
      const message = await this.insertMessage(organizationId, authorName, text, kind, null, null);
      this.logger.log(`"${text}" → neither`);
      return message;
    }

    // Embedding is the slow part, so do it before opening a transaction.
    const vector = toVectorLiteral(await embedText(text));

    // Find-or-create the cluster and save the message together, so a failure
    // halfway can't leave a cluster with no messages.
    return this.prisma.$transaction(async (tx) => {
      const nearest = await this.findNearestCluster(tx, organizationId, kind, vector);
      const threshold = this.settings.clusterSimilarity;
      const isJoining = nearest !== null && nearest.similarity >= threshold;

      // Logged so the thresholds can be tuned against the demo script.
      this.logger.log(
        `"${text}" → ${kind}, nearest cluster similarity ${nearest?.similarity.toFixed(3) ?? 'none'}` +
          ` (threshold ${threshold}) → ${isJoining ? 'join' : 'new cluster'}`,
      );

      const clusterId = isJoining
        ? nearest.id
        : await this.createCluster(tx, organizationId, kind, text, vector);

      const message = await this.insertMessage(
        organizationId,
        authorName,
        text,
        kind,
        clusterId,
        vector,
        tx,
      );

      if (isJoining) {
        await this.recomputeCentroid(tx, organizationId, clusterId);
      }

      return message;
    });
  }

  /**
   * Delete the organization's messages, clusters and reports, plus the
   * Company Brain alerts already sent, so the bell starts empty (the Reset button).
   */
  async reset(userId: string, organizationId: string): Promise<void> {
    await this.access.requireManager(userId, organizationId, 'reset the demo');

    await this.prisma.$transaction([
      // Bell entries first: they're found through the notification log,
      // which records each alert's in-app notification id. Only this
      // organization's brain alerts are touched.
      this.prisma.$executeRaw`
        DELETE FROM in_app_notifications WHERE id IN (
          SELECT metadata->>'inAppNotificationId' FROM notifications
          WHERE definition_name = 'brain-alert' AND organization_id = ${organizationId}
        )`,
      this.prisma.$executeRaw`
        DELETE FROM notifications
        WHERE definition_name = 'brain-alert' AND organization_id = ${organizationId}`,
      this.prisma.brainReport.deleteMany({ where: { organizationId } }),
      this.prisma.brainMessage.deleteMany({ where: { organizationId } }),
      this.prisma.brainCluster.deleteMany({ where: { organizationId } }),
    ]);
  }

  /**
   * The most similar cluster of the same kind. `<=>` is pgvector's cosine
   * distance (0 = same direction), so similarity is 1 minus it.
   */
  private async findNearestCluster(
    tx: PrismaTx,
    organizationId: string,
    kind: BrainMessageKind,
    vector: string,
  ): Promise<NearestCluster | null> {
    const rows = await tx.$queryRaw<NearestCluster[]>`
      SELECT id, (1 - (centroid <=> ${vector}::vector))::float8 AS similarity
      FROM brain_clusters
      WHERE organization_id = ${organizationId} AND kind = ${kind} AND centroid IS NOT NULL
      ORDER BY centroid <=> ${vector}::vector
      LIMIT 1`;
    return rows[0] ?? null;
  }

  /** Start a new cluster, named after its first message. */
  private async createCluster(
    tx: PrismaTx,
    organizationId: string,
    kind: BrainMessageKind,
    label: string,
    vector: string,
  ): Promise<string> {
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO brain_clusters (id, organization_id, kind, label, centroid)
      VALUES (${id}, ${organizationId}, ${kind}, ${label}, ${vector}::vector)`;
    return id;
  }

  /**
   * Reset the cluster's centre to the average of its members' vectors, so it
   * drifts toward what the group as a whole is talking about.
   */
  private async recomputeCentroid(
    tx: PrismaTx,
    organizationId: string,
    clusterId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE brain_clusters
      SET centroid = (
        SELECT AVG(embedding) FROM brain_messages
        WHERE cluster_id = ${clusterId} AND organization_id = ${organizationId}
      )
      WHERE id = ${clusterId} AND organization_id = ${organizationId}`;
  }

  private async insertMessage(
    organizationId: string,
    authorName: string,
    text: string,
    kind: BrainMessageKind,
    clusterId: string | null,
    vector: string | null,
    tx: PrismaTx = this.prisma,
  ): Promise<BrainMessage> {
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO brain_messages (id, organization_id, author_name, text, kind, cluster_id, embedding)
      VALUES (${id}, ${organizationId}, ${authorName}, ${text}, ${kind}, ${clusterId}, ${vector}::vector)`;

    const saved = await tx.brainMessage.findFirstOrThrow({ where: { id, organizationId } });
    return this.toResponse(saved);
  }

  private toResponse(message: BrainMessageRow): BrainMessage {
    return {
      id: message.id,
      authorName: message.authorName,
      channel: message.channel,
      text: message.text,
      kind: message.kind as BrainMessageKind,
      clusterId: message.clusterId,
      createdAt: message.createdAt.toISOString(),
    };
  }
}

/** Either the main Prisma client or one inside a transaction. */
type PrismaTx = Pick<PrismaService, '$queryRaw' | '$executeRaw' | 'brainMessage'>;
