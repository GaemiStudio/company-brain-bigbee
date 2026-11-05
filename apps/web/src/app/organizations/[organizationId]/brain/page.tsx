'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ChannelPanel } from '@/components/brain/ChannelPanel';
import { BrainPanel } from '@/components/brain/BrainPanel';
import { brainApi } from '@/lib/brain-api';

interface PageProps {
  params: Promise<{ organizationId: string }>;
}

/** Re-fetch the page state this often, so new messages and counters appear live. */
const POLL_INTERVAL_MS = 1000;

/**
 * The Company Brain demo page: the #it-help channel on the left, and the
 * brain (counters, reports, bedrock) on the right.
 */
export default function BrainPage({ params }: PageProps) {
  const { organizationId } = use(params);
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const stateQueryKey = ['brain-state', organizationId];
  const { data: state, isLoading } = useQuery({
    queryKey: stateQueryKey,
    queryFn: () => brainApi.getState(organizationId),
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Fetch fresh state now rather than waiting up to a second for the next poll.
  const refresh = () => queryClient.invalidateQueries({ queryKey: stateQueryKey });

  const handleSend = async (authorName: string, text: string) => {
    try {
      await brainApi.postMessage(organizationId, { authorName, text });
      await refresh();
    } catch (error) {
      toast.error((error as { message?: string }).message || 'Could not send the message.');
      throw error;
    }
  };

  const handleSimulate = async () => {
    setIsStarting(true);
    try {
      await brainApi.startSimulation(organizationId);
      await refresh();
    } catch (error) {
      toast.error((error as { message?: string }).message || 'Could not start the simulation.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await brainApi.reset(organizationId);
      await refresh();
      toast.success('Demo reset');
    } catch (error) {
      toast.error((error as { message?: string }).message || 'Could not reset the demo.');
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!state) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
          Company Brain is not available, or you do not have access to it.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/organizations/${organizationId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to organization
          </Link>
        </Button>

        <PageHeader
          title="Company Brain"
          description="Organic problems, solved organically, checked against the laws in stone."
        />

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <ChannelPanel
            messages={state.messages}
            authorNames={state.devices.map((device) => device.employeeName)}
            isWaitingForLiveMessage={state.simulation.isWaitingForLiveMessage}
            onSend={handleSend}
          />
          <BrainPanel
            organizationId={organizationId}
            state={state}
            isStarting={isStarting}
            isResetting={isResetting}
            onSimulate={handleSimulate}
            onReset={handleReset}
          />
        </div>
      </div>
    </PageContainer>
  );
}
