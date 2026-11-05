import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgRole } from '@prisma/client';
import { TriggerwareClient } from 'triggerware';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { BrainSettingsService } from './brain-settings.service';
import { ReportService } from './report.service';
import { joinWithOr, unique } from './text.util';

/** A Triggerware trigger: a SQL query re-run on a schedule. */
interface TriggerDefinition {
  name: string;
  description: string;
  sql: string;
  /** Runs once for each row that is new since the last run. */
  onRow: (row: unknown[]) => Promise<void>;
}

/** How long to wait before retrying when Triggerware isn't reachable. */
const RECONNECT_DELAY_MS = 10_000;

/**
 * Division of labour: the API refines messages and writes reports;
 * Triggerware watches. This service is the bridge between the two.
 *
 * On startup it (re)creates three triggers in Triggerware, each a SQL query
 * over the Brain tables in triggerware/tables:
 *   🔴 brain_problem_threshold: a problem reported by more than N employees
 *   🟢 brain_solution_signal: a success reported by at least M employees,
 *      none of whom use the browser the stuck employees use
 *   💎 brain_problem_solution_match: a problem and a solution that mean
 *      nearly the same thing
 *
 * Triggerware re-runs each query on TRIGGER_SCHEDULE and reports only rows
 * that are new since the last run. The queries return IDs only, never
 * counts, so a cluster growing from 6 to 7 to 8 people doesn't alert again.
 *
 * Every row carries its organization_id, and every follow-up query and
 * notification is scoped to it.
 */
@Injectable()
export class BrainWatcherService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BrainWatcherService.name);
  private client: TriggerwareClient | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: BrainSettingsService,
    private readonly reports: ReportService,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    // Tests boot the app without a Triggerware server, so stay off there.
    // TRIGGERWARE_ENABLED=false also turns it off, e.g. on a second API copy.
    const isTest = this.configService.get<string>('NODE_ENV') === 'test';
    const isDisabled = this.configService.get<string>('TRIGGERWARE_ENABLED') === 'false';
    if (isTest || isDisabled) {
      this.logger.log('Triggerware watcher disabled');
      return;
    }
    // Not awaited: a missing Triggerware server must not stop the API starting.
    void this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.client?.close().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    const address = this.settings.triggerwareAddress;
    try {
      this.client = await TriggerwareClient.connectTcp(address);
      await this.installTriggers(this.client);
      this.logger.log(`Watching Company Brain triggers on Triggerware at ${address}`);

      // If Triggerware restarts, the connection drops; reconnect when it does.
      void this.client.waitClosed().then(() => this.scheduleReconnect('connection closed'));
    } catch (error) {
      this.scheduleReconnect(`${error}`);
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.isShuttingDown) return;
    this.client = null;
    this.logger.warn(
      `Triggerware unavailable (${reason}). Is it running? ("triggerware start"). ` +
        `Retrying in ${RECONNECT_DELAY_MS / 1000}s.`,
    );
    this.reconnectTimer = setTimeout(() => void this.connect(), RECONNECT_DELAY_MS);
  }

  /**
   * Delete and recreate each trigger so its SQL always uses the current
   * thresholds. Triggerware treats rows that already exist at creation as
   * its starting point, so an API restart doesn't repeat old alerts.
   */
  private async installTriggers(client: TriggerwareClient): Promise<void> {
    const existing = await client.triggers.list();

    for (const trigger of this.triggerDefinitions()) {
      if (existing.includes(trigger.name)) {
        await client.triggers.delete(trigger.name);
      }
      await client.triggers.create({
        name: trigger.name,
        description: trigger.description,
        sql: trigger.sql,
        schedule: this.settings.triggerSchedule,
      });

      // Triggerware calls back with rows added (and removed) since the last
      // run. Removed rows come from Reset and need no action.
      await client.triggers.watch(trigger.name, async (added) => {
        for (const row of added) {
          try {
            await trigger.onRow(row);
          } catch (error) {
            this.logger.error(`${trigger.name} handler failed: ${error}`);
          }
        }
      });
    }
  }

  private triggerDefinitions(): TriggerDefinition[] {
    // Thresholds are numbers from our own settings, never user input, so
    // putting them into the SQL text is safe.
    const problemThreshold = this.settings.problemThreshold;
    const solutionThreshold = this.settings.solutionThreshold;
    const matchSimilarity = this.settings.matchSimilarity;

    return [
      {
        name: 'brain_problem_threshold',
        description: 'A problem cluster reported by more than the threshold of distinct employees',
        sql: `SELECT cluster_id, organization_id FROM brain_cluster_sizes
              WHERE kind = 'problem' AND authors > ${problemThreshold}`,
        onRow: ([clusterId, organizationId]) =>
          this.onProblem(String(organizationId), String(clusterId)),
      },
      {
        name: 'brain_solution_signal',
        description:
          'A success cluster big enough to matter, with nobody on the stuck employees’ browser',
        sql: `SELECT DISTINCT success_cluster_id, organization_id FROM brain_cluster_pairs
              WHERE problem_authors > ${problemThreshold}
                AND success_authors >= ${solutionThreshold}
                AND success_on_problem_browser = 0`,
        onRow: ([clusterId, organizationId]) =>
          this.onSolution(String(organizationId), String(clusterId)),
      },
      {
        name: 'brain_problem_solution_match',
        description: 'A triggered problem and solution whose meanings line up',
        // Similarity is deliberately not selected: it shifts with every new
        // message, which would make the same pair look "new" each run.
        sql: `SELECT DISTINCT problem_cluster_id, success_cluster_id, organization_id
              FROM brain_cluster_pairs
              WHERE problem_authors > ${problemThreshold}
                AND success_authors >= ${solutionThreshold}
                AND success_on_problem_browser = 0
                AND similarity >= ${matchSimilarity}`,
        onRow: ([problemClusterId, successClusterId, organizationId]) =>
          this.onMatch(String(organizationId), String(problemClusterId), String(successClusterId)),
      },
    ];
  }

  /** 🔴 Enough people report the same problem. */
  private async onProblem(organizationId: string, clusterId: string): Promise<void> {
    const cluster = await this.loadClusterSummary(organizationId, clusterId);
    if (!cluster) return;

    this.logger.log(`🔴 problem threshold: ${cluster.authors} authors, "${cluster.label}"`);
    await this.notifyManagers(organizationId, {
      title: '🔴 Organic problem detected',
      body: `${cluster.authors} employees report the same problem: “${cluster.label}”`,
    });
  }

  /** 🟢 A group that doesn't have the problem, and uses a different browser. */
  private async onSolution(organizationId: string, clusterId: string): Promise<void> {
    const cluster = await this.loadClusterSummary(organizationId, clusterId);
    if (!cluster) return;

    const devices = await this.loadClusterDevices(organizationId, clusterId);
    const problemBrowser = await this.loadProblemBrowser(organizationId, clusterId);
    const osList = joinWithOr(unique(devices.map((device) => device.os)));
    const browserList = joinWithOr(unique(devices.map((device) => device.browser)));

    this.logger.log(`🟢 solution signal: ${cluster.authors} authors, "${cluster.label}"`);
    await this.notifyManagers(organizationId, {
      title: '🟢 Organic solution signal',
      body:
        `${cluster.authors} employees say it works for them: “${cluster.label}” ` +
        `Per the IT inventory, they're all on ${osList} with ${browserList}` +
        (problemBrowser ? `, while the stuck employees are on ${problemBrowser}.` : '.'),
    });
  }

  /** 💎 The solution lines up with the problem: write the report. */
  private async onMatch(
    organizationId: string,
    problemClusterId: string,
    successClusterId: string,
  ): Promise<void> {
    const report = await this.reports.createForMatch(
      organizationId,
      problemClusterId,
      successClusterId,
    );
    if (!report) return;

    this.logger.log(`💎 match: similarity ${report.similarity.toFixed(3)}, report ${report.id}`);
    await this.notifyManagers(
      organizationId,
      {
        title: '💎 Problem and solution matched',
        body: `Similarity ${report.similarity.toFixed(2)}. The report is ready.`,
      },
      `/organizations/${organizationId}/brain/reports/${report.id}`,
    );
  }

  /** Send to every OWNER and ADMIN: the people who'd act on it (Priya). */
  private async notifyManagers(
    organizationId: string,
    message: { title: string; body: string },
    actionPath = `/organizations/${organizationId}/brain`,
  ): Promise<void> {
    const managers = await this.prisma.organizationMember.findMany({
      where: { organizationId, role: { in: [OrgRole.OWNER, OrgRole.ADMIN] } },
      select: { userId: true },
    });
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    for (const manager of managers) {
      await this.notifications.sendNotification(
        'brain-alert',
        { type: 'userId', userId: manager.userId },
        {
          ...message,
          organizationId,
          actionPath,
          actionUrl: `${frontendUrl}${actionPath}`,
        },
        organizationId,
      );
    }
  }

  private async loadClusterSummary(
    organizationId: string,
    clusterId: string,
  ): Promise<{ label: string; authors: number } | null> {
    const cluster = await this.prisma.brainCluster.findFirst({
      where: { id: clusterId, organizationId },
      select: { label: true, messages: { select: { authorName: true } } },
    });
    if (!cluster) return null;
    return {
      label: cluster.label,
      authors: new Set(cluster.messages.map((message) => message.authorName)).size,
    };
  }

  /** The laptops of everyone who wrote in a cluster, per the IT inventory. */
  private async loadClusterDevices(
    organizationId: string,
    clusterId: string,
  ): Promise<{ os: string; browser: string }[]> {
    const messages = await this.prisma.brainMessage.findMany({
      where: { clusterId, organizationId },
      select: { authorName: true },
    });
    return this.prisma.brainDevice.findMany({
      where: { organizationId, employeeName: { in: messages.map((m) => m.authorName) } },
      select: { os: true, browser: true },
    });
  }

  /** The browser of the largest triggered problem this success cluster is paired with. */
  private async loadProblemBrowser(
    organizationId: string,
    successClusterId: string,
  ): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ problem_browser: string | null }[]>`
      SELECT problem_browser FROM brain_cluster_pairs
      WHERE organization_id = ${organizationId} AND success_cluster_id = ${successClusterId}
        AND problem_authors > ${this.settings.problemThreshold}
      ORDER BY problem_authors DESC
      LIMIT 1`;
    return rows[0]?.problem_browser ?? null;
  }
}

