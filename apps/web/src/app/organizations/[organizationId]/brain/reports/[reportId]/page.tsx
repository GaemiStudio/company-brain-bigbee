'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { BrainReportContent } from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { brainApi } from '@/lib/brain-api';

interface PageProps {
  params: Promise<{ organizationId: string; reportId: string }>;
}

/**
 * The brain's report for the manager: the problem, the evidence from the IT
 * inventory, the organic solution, how it measures up against policy, and
 * what to do next.
 */
export default function BrainReportPage({ params }: PageProps) {
  const { organizationId, reportId } = use(params);

  const { data: report, isLoading } = useQuery({
    queryKey: ['brain-report', organizationId, reportId],
    queryFn: () => brainApi.getReport(organizationId, reportId),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!report) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
          Report not found, or you do not have access to it.
        </div>
      </PageContainer>
    );
  }

  const { content } = report;

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/organizations/${organizationId}/brain`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Company Brain
          </Link>
        </Button>

        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              💎 Report
              <Badge variant="secondary">similarity {report.similarity.toFixed(2)}</Badge>
            </span>
          }
          description={`Written ${new Date(report.createdAt).toLocaleString()}`}
        />

        <ReportSection title="Problem">
          <p>
            <strong>{content.problem.employeeCount} employees</strong> report: “
            {content.problem.label}”
          </p>
          <p className="text-sm text-muted-foreground">
            First report {minutesAgo(content.problem.firstReportedAt, report.createdAt)}.
          </p>
        </ReportSection>

        <ReportSection title="Evidence from the IT inventory">
          <EvidenceTable evidence={content.evidence} />
        </ReportSection>

        <ReportSection title="Organic solution">
          <p>
            <strong>{content.solution.employeeCount} employees</strong> get through: “
            {content.solution.label}”
          </p>
          <p>{content.solution.statement}</p>
          <p className="text-sm text-muted-foreground">Workaround: {content.solution.workaround}</p>
        </ReportSection>

        <ReportSection title="Checked against bedrock">
          <ul className="space-y-3">
            {content.policyChecks.map((check) => (
              <li key={check.code} className="flex gap-2">
                <span aria-label={check.verdict === 'warning' ? 'Warning' : 'OK'}>
                  {check.verdict === 'warning' ? '⚠️' : '✅'}
                </span>
                <span>
                  <span className="font-mono text-xs text-muted-foreground">{check.code}</span>{' '}
                  {check.text}
                </span>
              </li>
            ))}
            {content.chatRisks.map((risk) => (
              <li key={`${risk.authorName}-${risk.text}`} className="flex gap-2">
                <span aria-label="Warning">⚠️</span>
                <span>
                  <span className="font-mono text-xs text-muted-foreground">Chat</span>{' '}
                  {risk.authorName} said “{risk.text}”. That&apos;s a possible unapproved install
                  to follow up on.
                </span>
              </li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection title="Recommendation">
          <ol className="list-decimal space-y-2 pl-5">
            {content.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ol>
        </ReportSection>
      </div>
    </PageContainer>
  );
}

const ReportSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">{children}</CardContent>
  </Card>
);

const EvidenceTable = ({ evidence }: { evidence: BrainReportContent['evidence'] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Laptop / browser</TableHead>
        <TableHead className="text-right">Stuck</TableHead>
        <TableHead className="text-right">Got through</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {evidence.map((row) => (
        <TableRow key={`${row.os}-${row.browser}`}>
          <TableCell>
            {row.os} / {row.browser}
          </TableCell>
          <TableCell className="text-right tabular-nums">{row.stuck}</TableCell>
          <TableCell className="text-right tabular-nums">{row.succeeded}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

/** "47 minutes ago" style text, measured to when the report was written. */
const minutesAgo = (from: string, to: string): string => {
  const minutes = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
  if (minutes < 1) return 'less than a minute before this report';
  return `${minutes} minute${minutes === 1 ? '' : 's'} before this report`;
};
