'use client';

import Link from 'next/link';
import { FileText, Gem, Loader2, Play, RotateCcw } from 'lucide-react';
import type { BrainState } from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BrainPanelProps {
  organizationId: string;
  state: BrainState;
  isStarting: boolean;
  isResetting: boolean;
  onSimulate: () => void;
  onReset: () => void;
}

/**
 * The brain's side of the page: the problem and solution counters, the
 * Simulate and Reset buttons, any reports, and the "bedrock" (verified
 * policies and the laptop inventory) the brain checks ideas against.
 */
export const BrainPanel = ({
  organizationId,
  state,
  isStarting,
  isResetting,
  onSimulate,
  onReset,
}: BrainPanelProps) => {
  const { simulation } = state;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSimulate} disabled={simulation.isRunning || isStarting}>
          {isStarting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Simulate a workday
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isResetting}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {simulationText(state)}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Counter
          label="🔴 Problem reports"
          value={state.problemCount}
          threshold={`fires above ${state.problemThreshold}`}
          isTriggered={state.problemCount > state.problemThreshold}
        />
        <Counter
          label="🟢 Solution reports"
          value={state.solutionCount}
          threshold={`fires at ${state.solutionThreshold}`}
          isTriggered={state.solutionCount >= state.solutionThreshold}
        />
      </div>

      {state.reports.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gem className="h-4 w-4" aria-hidden />
              Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.reports.map((report) => (
              <Link
                key={report.id}
                href={`/organizations/${organizationId}/brain/reports/${report.id}`}
                className="flex items-start gap-2 rounded-md border p-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{report.title}</span>
                <Badge variant="secondary">{report.similarity.toFixed(2)}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bedrock: policies and data</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {state.facts.map((fact) => (
              <li key={fact.code}>
                <span className="font-mono text-xs text-muted-foreground">{fact.code}</span>{' '}
                {fact.body}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bedrock: IT laptop inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {state.devices.map((device) => (
              <li key={device.employeeName} className="flex justify-between gap-2">
                <span>{device.employeeName}</span>
                <span className="text-muted-foreground">
                  {device.os} · {device.browser}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

interface CounterProps {
  label: string;
  value: number;
  threshold: string;
  isTriggered: boolean;
}

const Counter = ({ label, value, threshold, isTriggered }: CounterProps) => (
  <div className={cn('rounded-lg border bg-card p-4', isTriggered && 'border-primary ring-1 ring-primary')}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-3xl font-semibold tabular-nums">{value}</div>
    <div className="text-xs text-muted-foreground">{threshold}</div>
  </div>
);

const simulationText = (state: BrainState): string => {
  const { simulation } = state;
  if (simulation.isWaitingForLiveMessage) {
    return 'Paused: type the live message as Jane Doe to continue.';
  }
  if (simulation.isRunning) {
    return `Simulating… ${simulation.position} of ${simulation.total} messages`;
  }
  return 'Distinct employees in the largest problem and solution groups.';
};
