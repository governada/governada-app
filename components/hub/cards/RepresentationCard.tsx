'use client';

import { ShieldCheck, ShieldAlert, ShieldX, User } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceHolder } from '@/hooks/queries';
import { HubCard, HubCardSkeleton, HubCardError, type CardUrgency } from './HubCard';
import { computeTier } from '@/lib/scoring/tiers';
import { getScoreNarrative } from '@/lib/scoring/scoreNarratives';

/**
 * RepresentationCard — THE citizen's primary card.
 *
 * Shows at a glance: Do I have a DRep? Are they active? Are they voting?
 * Also shows pool governance status if they have a staking pool.
 *
 * JTBD: "Is my ADA represented in governance?"
 * One conclusion + one link to /delegation for details.
 */
export function RepresentationCard() {
  const { stakeAddress, delegatedDrep, delegatedPool } = useSegment();
  const { data: holderRaw, isLoading, isError, refetch } = useGovernanceHolder(stakeAddress);

  // Undelegated citizens don't need holder data — show CTA immediately
  if (!delegatedDrep) {
    return (
      <HubCard href="/match" urgency="warning" label="You have no DRep. Find a representative.">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Unrepresented
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">
            Your ADA has no voice in governance
          </p>
          <p className="text-sm text-muted-foreground">
            Find a DRep who shares your values &mdash; takes 60 seconds.
          </p>
        </div>
      </HubCard>
    );
  }

  if (isLoading) return <HubCardSkeleton />;
  if (isError)
    return <HubCardError message="Couldn't load delegation status" onRetry={() => refetch()} />;

  // Delegated state — build the summary
  const holder = holderRaw as Record<string, unknown> | undefined;
  const drep = holder?.drep as Record<string, unknown> | undefined;
  const drepName = (drep?.name as string) || (drep?.ticker as string) || 'Your DRep';
  const drepScore = (drep?.score as number) ?? 0;
  const isActive = (drep?.isActive as boolean) ?? true;
  const participationRate = (drep?.participationRate as number) ?? 0;
  // Determine urgency
  let urgency: CardUrgency = 'success';
  let statusLabel = 'Represented';
  let statusMessage = `${drepName} is active`;

  if (!isActive) {
    urgency = 'critical';
    statusLabel = 'DRep Inactive';
    statusMessage = `${drepName} is no longer active`;
  } else if (participationRate < 50) {
    urgency = 'warning';
    statusLabel = 'Low Participation';
    statusMessage = `${drepName} has voted on ${Math.round(participationRate)}% of proposals`;
  } else {
    const voteCount = Math.round(participationRate);
    statusMessage = `${drepName} is active, ${voteCount}% participation`;
  }

  const StatusIcon =
    urgency === 'success' ? ShieldCheck : urgency === 'warning' ? ShieldAlert : ShieldX;
  const statusColor =
    urgency === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : urgency === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <HubCard href="/delegation" urgency={urgency} label={`${statusLabel}: ${statusMessage}`}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusColor}`} />
          <span className={`text-xs font-medium uppercase tracking-wider ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-base font-semibold text-foreground">{statusMessage}</p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            Score: {Math.round(drepScore)} &middot; {computeTier(drepScore)} &mdash;{' '}
            {getScoreNarrative({ score: drepScore, percentile: 50 })}
          </span>
          <span className="text-muted-foreground/60">&middot;</span>
          <span>{delegatedPool ? 'Pool + DRep delegated' : 'Partial coverage'}</span>
        </div>
      </div>
    </HubCard>
  );
}
