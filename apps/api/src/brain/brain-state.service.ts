import { Injectable } from '@nestjs/common';
import { BrainFact, BrainState } from '@app-starter/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BrainSettingsService } from './brain-settings.service';
import { MessagesService } from './messages.service';
import { ReportService } from './report.service';
import { SimulateService } from './simulate.service';

/**
 * Everything the Company Brain page shows, in one response, so the page can
 * poll a single URL every second.
 */
@Injectable()
export class BrainStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BrainSettingsService,
    private readonly messages: MessagesService,
    private readonly reports: ReportService,
    private readonly simulate: SimulateService,
  ) {}

  async getState(userId: string, organizationId: string): Promise<BrainState> {
    // messages.list checks that the caller is a member of the organization
    // before anything else is read.
    const messageList = await this.messages.list(userId, organizationId);

    const [counts, facts, devices, reports, simulation] = await Promise.all([
      this.loadBiggestClusters(organizationId),
      this.prisma.brainFact.findMany({ where: { organizationId }, orderBy: { code: 'asc' } }),
      this.prisma.brainDevice.findMany({
        where: { organizationId },
        orderBy: { employeeName: 'asc' },
      }),
      this.reports.listSummaries(organizationId),
      this.simulate.status(userId, organizationId),
    ]);

    return {
      messages: messageList.items,
      problemCount: counts.problem,
      solutionCount: counts.success,
      problemThreshold: this.settings.problemThreshold,
      solutionThreshold: this.settings.solutionThreshold,
      facts: facts.map((fact) => ({
        code: fact.code,
        kind: fact.kind as BrainFact['kind'],
        title: fact.title,
        body: fact.body,
      })),
      devices: devices.map((device) => ({
        employeeName: device.employeeName,
        laptop: device.laptop,
        os: device.os,
        browser: device.browser,
      })),
      reports,
      simulation,
    };
  }

  /** Distinct employees in the biggest problem cluster and the biggest success cluster. */
  private async loadBiggestClusters(
    organizationId: string,
  ): Promise<{ problem: number; success: number }> {
    const rows = await this.prisma.$queryRaw<{ kind: string; authors: number }[]>`
      SELECT kind, MAX(authors)::int AS authors FROM brain_cluster_sizes
      WHERE organization_id = ${organizationId}
      GROUP BY kind`;
    const byKind = new Map(rows.map((row) => [row.kind, row.authors]));
    return { problem: byKind.get('problem') ?? 0, success: byKind.get('success') ?? 0 };
  }
}
