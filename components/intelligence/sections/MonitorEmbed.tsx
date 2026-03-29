'use client';

/**
 * MonitorEmbed — inline monitoring dashboard for submitted proposals.
 *
 * Embeds existing VotingProgress, VoteActivity, and DepositStatus components
 * directly in the intelligence brief instead of requiring navigation to /monitor.
 */

import { Loader2 } from 'lucide-react';
import { useProposalMonitor } from '@/hooks/useProposalMonitor';
import { VotingProgress } from '@/components/workspace/author/monitor/VotingProgress';
import { VoteActivity } from '@/components/workspace/author/monitor/VoteActivity';
import { DepositStatus } from '@/components/workspace/author/monitor/DepositStatus';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonitorEmbedProps {
  txHash: string;
  proposalIndex: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonitorEmbed({ txHash, proposalIndex }: MonitorEmbedProps) {
  const { data, isLoading, isError } = useProposalMonitor(txHash, proposalIndex);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading monitoring data...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-xs text-muted-foreground/60 py-2 text-center">
        Monitoring data not yet available
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <VotingProgress voting={data.voting} compact />
      <DepositStatus
        deposit={data.deposit}
        expirationEpoch={data.expirationEpoch}
        status={data.status}
      />
      <VoteActivity votes={data.recentVotes} currentEpoch={data.currentEpoch} />
    </div>
  );
}
