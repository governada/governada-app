'use client';

import { AlertTriangle, Clock, Vote } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDashboardUrgent } from '@/hooks/queries';
import { HubCard, HubCardSkeleton, HubCardError, type CardUrgency } from './HubCard';

interface UrgentProposal {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  epochsRemaining: number;
}

/**
 * ActionCard — Time-sensitive items for DReps.
 *
 * Shows pending votes with deadline urgency.
 * Red: expiring this epoch. Amber: expiring next epoch.
 * Links to /workspace for action queue.
 *
 * JTBD: "What needs my vote right now?"
 */
export function ActionCard() {
  const { drepId } = useSegment();
  const { data: urgentRaw, isLoading, isError, refetch } = useDashboardUrgent(drepId);

  if (isLoading) return <HubCardSkeleton />;
  if (isError)
    return <HubCardError message="Couldn't load pending votes" onRetry={() => refetch()} />;

  const urgentData = urgentRaw as Record<string, unknown> | undefined;
  const urgentProposals = (urgentData?.urgent as UrgentProposal[]) ?? [];
  const pendingCount = (urgentData?.pendingCount as number) ?? urgentProposals.length;
  const unexplainedVotes = (urgentData?.unexplainedVotes as unknown[]) ?? [];

  // Nothing urgent — caught up
  if (pendingCount === 0 && unexplainedVotes.length === 0) {
    return (
      <HubCard
        href="/workspace"
        urgency="success"
        label="All caught up. No proposals need your vote."
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Vote className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              All Caught Up
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">
            No proposals need your vote right now
          </p>
        </div>
      </HubCard>
    );
  }

  // Determine urgency level
  const hasExpiringSoon = urgentProposals.some((p) => p.epochsRemaining <= 1);
  const urgency: CardUrgency = hasExpiringSoon ? 'critical' : 'warning';

  const urgencyColor =
    urgency === 'critical'
      ? 'text-red-600 dark:text-red-400'
      : 'text-amber-600 dark:text-amber-400';
  const UrgencyIcon = hasExpiringSoon ? AlertTriangle : Clock;

  return (
    <HubCard href="/workspace" urgency={urgency} label={`${pendingCount} proposals need your vote`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <UrgencyIcon className={`h-4 w-4 ${urgencyColor}`} />
          <span className={`text-xs font-medium uppercase tracking-wider ${urgencyColor}`}>
            {hasExpiringSoon ? 'Votes Expiring' : 'Votes Pending'}
          </span>
        </div>
        <p className="text-base font-semibold text-foreground">
          {pendingCount} proposal{pendingCount !== 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''}{' '}
          your vote
        </p>
        {urgentProposals[0] && (
          <p className="text-sm text-muted-foreground truncate">
            {urgentProposals[0].epochsRemaining === 0
              ? 'Expires this epoch'
              : `Next: ${urgentProposals[0].title}`}
          </p>
        )}
      </div>
    </HubCard>
  );
}
