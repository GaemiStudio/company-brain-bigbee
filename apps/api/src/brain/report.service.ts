import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BrainEvidenceRow,
  BrainPolicyCheck,
  BrainReport,
  BrainReportContent,
  BrainReportSummary,
} from '@app-starter/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BrainAccessService } from './brain-access.service';
import { embedText, toVectorLiteral } from './embedding';
import { joinWithOr, unique } from './text.util';
import { BrainReportNotFoundException } from './exceptions/brain.exceptions';

/** A fact found by meaning, with how close it was (0–1). */
interface NearbyFact {
  code: string;
  kind: string;
  body: string;
  similarity: number;
}

/** A chat author and the laptop the IT inventory says they use. */
interface AuthorDevice {
  authorName: string;
  os: string | null;
  browser: string | null;
}

/** How many of the closest facts each policy-check search considers. */
const SOLUTION_FACT_LIMIT = 6;
const PROBLEM_FACT_LIMIT = 3;

/** Browsers we look for in "I'll just download Chrome"-style messages. */
const BROWSER_NAMES = ['chrome', 'edge', 'firefox', 'safari'] as const;

/**
 * Writes the manager's report when 💎 fires: a template filled with numbers
 * from the database and the policies closest in meaning to the solution.
 * No AI writing is involved, so it works offline.
 *
 * Steps (from COMPANY_BRAIN_SPEC.md):
 *   1. Evidence: count both groups by laptop and browser (IT inventory)
 *   2. Solution statement: which browsers get through vs. get stuck
 *   3. Chat risk scan: someone planning to install a browser themselves
 *   4. Policy check: nearest facts by vector, tagged ⚠️ or ✅ by simple rules
 *   5. Recommendation: fixed sentences filled in from the above
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrainAccessService,
  ) {}

  /**
   * Build and save the report for a matched problem and solution. Returns
   * null if one already exists for this pair (so the alert isn't repeated)
   * or if either cluster has gone (e.g. after Reset).
   */
  async createForMatch(
    organizationId: string,
    problemClusterId: string,
    successClusterId: string,
  ): Promise<BrainReport | null> {
    const existing = await this.prisma.brainReport.findFirst({
      where: { organizationId, problemClusterId, successClusterId },
      select: { id: true },
    });
    if (existing) return null;

    const [problem, success] = await Promise.all([
      this.prisma.brainCluster.findFirst({
        where: { id: problemClusterId, organizationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.brainCluster.findFirst({
        where: { id: successClusterId, organizationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
    ]);
    if (!problem || !success || problem.messages.length === 0) return null;

    const similarity = await this.loadSimilarity(organizationId, problemClusterId, successClusterId);

    // Step 1: evidence. Who was stuck and who got through, by laptop/browser.
    const stuckDevices = await this.loadDevices(organizationId, problem.messages);
    const succeededDevices = await this.loadDevices(organizationId, success.messages);
    const evidence = buildEvidence(stuckDevices, succeededDevices);

    // Step 2: the solution in one sentence.
    const problemBrowser = mostCommon(stuckDevices.map((device) => device.browser));
    const problemOs = mostCommon(stuckDevices.map((device) => device.os));
    const successBrowsers = unique(succeededDevices.map((device) => device.browser));
    const successBrowserText = joinWithOr(successBrowsers, 'another browser');
    const statement =
      `Employees on ${successBrowserText} get through; ` +
      `stuck employees are all on ${problemBrowser ?? 'another browser'}.`;
    const workaround = `Use a different browser (${successBrowserText}) until it's fixed.`;

    // Step 3: chat risk scan. Anyone planning to install a browser themselves?
    const chatRisks = problem.messages
      .filter((message) => mentionsInstallingBrowser(message.text))
      .map((message) => ({ authorName: message.authorName, text: message.text }));

    // Step 4: policy check. Two searches by meaning, merged: facts closest to
    // the proposed fix (e.g. software-install rules) and facts closest to what
    // the stuck employees actually said (e.g. "deadline is Friday").
    const nearbyFacts = mergeFacts(
      await this.findNearbyFacts(
        organizationId,
        `${problem.label}. ${statement} ${workaround}`,
        SOLUTION_FACT_LIMIT,
      ),
      await this.findNearbyFacts(
        organizationId,
        problem.messages.map((message) => message.text).join(' '),
        PROBLEM_FACT_LIMIT,
      ),
    );
    const policyChecks = nearbyFacts.flatMap((fact) => {
      const check = checkFact(fact);
      return check ? [check] : [];
    });

    // Step 5: recommendations, using only what the checks actually found.
    const content: BrainReportContent = {
      problem: {
        label: problem.label,
        employeeCount: uniqueAuthors(problem.messages),
        firstReportedAt: problem.messages[0].createdAt.toISOString(),
      },
      evidence,
      solution: {
        label: success.label,
        employeeCount: uniqueAuthors(success.messages),
        statement,
        workaround,
      },
      chatRisks,
      policyChecks,
      recommendations: buildRecommendations({
        problemLabel: problem.label,
        problemBrowser,
        problemOs,
        successBrowsers,
        chatRisks,
        policyCodes: new Set(policyChecks.map((check) => check.code)),
      }),
    };

    const report = await this.prisma.brainReport.create({
      data: {
        organizationId,
        problemClusterId,
        successClusterId,
        similarity,
        content: content as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toResponse(report);
  }

  async findOne(userId: string, organizationId: string, reportId: string): Promise<BrainReport> {
    await this.access.requireMember(userId, organizationId, 'view reports');

    // Loaded by id AND organization: another tenant's report reads as 404.
    const report = await this.prisma.brainReport.findFirst({
      where: { id: reportId, organizationId },
    });
    if (!report) throw new BrainReportNotFoundException(reportId);

    return this.toResponse(report);
  }

  /** Short list for the Brain page. No role check: the caller has done it. */
  async listSummaries(organizationId: string): Promise<BrainReportSummary[]> {
    const reports = await this.prisma.brainReport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map((report) => {
      const content = report.content as unknown as BrainReportContent;
      return {
        id: report.id,
        title: content.problem.label,
        similarity: report.similarity,
        createdAt: report.createdAt.toISOString(),
      };
    });
  }

  private async loadSimilarity(
    organizationId: string,
    problemClusterId: string,
    successClusterId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ similarity: number }[]>`
      SELECT similarity FROM brain_cluster_pairs
      WHERE organization_id = ${organizationId}
        AND problem_cluster_id = ${problemClusterId}
        AND success_cluster_id = ${successClusterId}`;
    return rows[0]?.similarity ?? 0;
  }

  /** One entry per distinct author, with their laptop if it's in the inventory. */
  private async loadDevices(
    organizationId: string,
    messages: readonly { authorName: string }[],
  ): Promise<AuthorDevice[]> {
    const authorNames = unique(messages.map((message) => message.authorName));
    const devices = await this.prisma.brainDevice.findMany({
      where: { organizationId, employeeName: { in: authorNames } },
    });
    const byName = new Map(devices.map((device) => [device.employeeName, device]));
    return authorNames.map((authorName) => ({
      authorName,
      os: byName.get(authorName)?.os ?? null,
      browser: byName.get(authorName)?.browser ?? null,
    }));
  }

  /** The organization's facts, closest in meaning to `text` first. */
  private async findNearbyFacts(
    organizationId: string,
    text: string,
    limit: number,
  ): Promise<NearbyFact[]> {
    const vector = toVectorLiteral(await embedText(text));
    const facts = await this.prisma.$queryRaw<NearbyFact[]>`
      SELECT code, kind, body, (1 - (embedding <=> ${vector}::vector))::float8 AS similarity
      FROM brain_facts
      WHERE organization_id = ${organizationId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${limit}`;

    // Logged so the policy matching can be tuned during rehearsal.
    this.logger.log(
      `Nearest facts: ${facts.map((f) => `${f.code} ${f.similarity.toFixed(2)}`).join(', ')}`,
    );
    return facts;
  }

  private toResponse(report: {
    id: string;
    similarity: number;
    content: Prisma.JsonValue;
    createdAt: Date;
  }): BrainReport {
    return {
      id: report.id,
      similarity: report.similarity,
      content: report.content as unknown as BrainReportContent,
      createdAt: report.createdAt.toISOString(),
    };
  }
}

/** Combine two fact searches, keeping each fact once, closest first. */
const mergeFacts = (...lists: NearbyFact[][]): NearbyFact[] => {
  const byCode = new Map<string, NearbyFact>();
  for (const fact of lists.flat()) {
    const seen = byCode.get(fact.code);
    if (!seen || fact.similarity > seen.similarity) byCode.set(fact.code, fact);
  }
  return [...byCode.values()].sort((a, b) => b.similarity - a.similarity);
};

/**
 * Tag a fact as a warning or as guidance using simple word rules. Facts no
 * rule recognizes (like the password-rotation distractor) are left out.
 */
const checkFact = (fact: NearbyFact): BrainPolicyCheck | null => {
  const body = fact.body.toLowerCase();
  const base = { code: fact.code, similarity: fact.similarity };

  // Installing software: a do-it-yourself browser install would break it.
  if (/\b(approved|installed?)\b/.test(body)) {
    return {
      ...base,
      verdict: 'warning',
      text: `“${fact.body}” Employees installing a browser themselves would break this policy.`,
    };
  }

  // Fleet share, like "230 employees ... 62% of laptops": estimate the impact.
  const employees = body.match(/(\d+)\s+employees/);
  const percent = body.match(/(\d+(?:\.\d+)?)%/);
  if (fact.kind === 'data' && employees && percent) {
    const affected = Math.round((Number(employees[1]) * Number(percent[1])) / 100);
    return {
      ...base,
      verdict: 'warning',
      text: `“${fact.body}” About ${affected} employees are likely affected.`,
    };
  }

  // Deadlines make the problem urgent.
  if (/\bdue\b|\bdeadline\b/.test(body)) {
    return { ...base, verdict: 'warning', text: `“${fact.body}”` };
  }

  // Severity rules and temporary workarounds point to the right course.
  if (/\bsev-?\d\b|\bsla\b|\btemporary workaround\b/.test(body)) {
    return { ...base, verdict: 'ok', text: `“${fact.body}”` };
  }

  return null;
};

/** The fixed recommendation template, filled from what the report found. */
const buildRecommendations = (input: {
  problemLabel: string;
  problemBrowser: string | null;
  problemOs: string | null;
  successBrowsers: string[];
  chatRisks: { authorName: string }[];
  policyCodes: ReadonlySet<string>;
}): string[] => {
  const browser = input.problemBrowser ?? 'the affected browser';
  const replacement = input.successBrowsers[0] ?? 'a working browser';
  const recommendations: string[] = [];

  if (input.policyCodes.has('IT-11')) {
    recommendations.push(
      `Open a Sev-2 ticket (IT-11) with the tool's team: “${input.problemLabel}”, ` +
        `failing in ${browser}. Due within 2 business days.`,
    );
  } else {
    recommendations.push(`Open a ticket: “${input.problemLabel}”, failing in ${browser}.`);
  }

  if (input.policyCodes.has('IT-12')) {
    recommendations.push(
      `Approve a temporary workaround (IT-12): push an IT-managed ${replacement} install to ` +
        `${input.problemOs ?? 'affected'} laptops for 14 days, instead of letting employees install it themselves.`,
    );
  }

  const deadline = input.policyCodes.has('FIN-02') ? ", before Friday's deadline (FIN-02)" : '';
  recommendations.push(`Post a status update in #it-announcements now${deadline}.`);

  if (input.chatRisks.length > 0) {
    const names = unique(input.chatRisks.map((risk) => risk.authorName)).join(', ');
    recommendations.push(`Follow up with ${names}, who mentioned installing a browser.`);
  }

  return recommendations;
};

/** Count stuck vs. succeeded employees for each OS + browser combination. */
const buildEvidence = (
  stuck: readonly AuthorDevice[],
  succeeded: readonly AuthorDevice[],
): BrainEvidenceRow[] => {
  const rows = new Map<string, BrainEvidenceRow>();
  const add = (device: AuthorDevice, field: 'stuck' | 'succeeded') => {
    const os = device.os ?? 'Unknown';
    const browser = device.browser ?? 'Unknown';
    const key = `${os}/${browser}`;
    const row = rows.get(key) ?? { os, browser, stuck: 0, succeeded: 0 };
    row[field] += 1;
    rows.set(key, row);
  };
  stuck.forEach((device) => add(device, 'stuck'));
  succeeded.forEach((device) => add(device, 'succeeded'));
  return [...rows.values()];
};

const mentionsInstallingBrowser = (text: string): boolean => {
  const lower = text.toLowerCase();
  return (
    /\b(download|install)/.test(lower) && BROWSER_NAMES.some((name) => lower.includes(name))
  );
};

const uniqueAuthors = (messages: readonly { authorName: string }[]): number =>
  new Set(messages.map((message) => message.authorName)).size;

/** The value that appears most often, ignoring unknowns. */
const mostCommon = (values: readonly (string | null)[]): string | null => {
  const counts = new Map<string, number>();
  values.forEach((value) => value && counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};
