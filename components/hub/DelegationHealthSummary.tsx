'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Server,
  Clock,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceHolder, useSPOSummary } from '@/hooks/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Convert epoch number to a human-readable date range */
function epochDateRange(epoch: number): string {
  const SHELLEY_GENESIS = 1596491091;
  const EPOCH_LEN = 432000;
  const BASE_EPOCH = 209;
  const startUnix = SHELLEY_GENESIS + (epoch - BASE_EPOCH) * EPOCH_LEN;
  const end = new Date((startUnix + EPOCH_LEN) * 1000);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return fmt(end);
}

type HealthStatus = 'green' | 'yellow' | 'red';

/**
 * DelegationHealthSummary — the "hands-off" health check card.
 *
 * Shows at all depth levels. Tells the user at a glance:
 * - Is my DRep active? How often are they voting?
 * - Is my pool participating in governance?
 * - How many decision types am I covered for?
 * - When is the next epoch boundary?
 *
 * Owns its own data hooks so they only fire when this component mounts.
 */
export function DelegationHealthSummary() {
  // Capture timestamp once on mount to avoid impure Date.now() during render
  const [mountTime] = useState(() => Math.floor(Date.now() / 1000));
  const { stakeAddress, delegatedDrep, delegatedPool } = useSegment();
  const { data: holderRaw, isLoading: holderLoading } = useGovernanceHolder(stakeAddress);
  const { data: poolRaw, isLoading: poolLoading } = useSPOSummary(delegatedPool);

  if (!stakeAddress) return null;
  if (holderLoading || poolLoading) {
    return (
      <Card className="border-white/[0.08] bg-card/15 backdrop-blur-md">
        <CardContent className="space-y-3 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  // Extract DRep data
  const holder = holderRaw as Record<string, unknown> | undefined;
  const drep = holder?.drep as Record<string, unknown> | undefined;
  const drepName = (drep?.name as string) || (drep?.ticker as string) || 'Your DRep';
  const drepIsActive = (drep?.isActive as boolean) ?? true;
  const drepVoteCount = (drep?.voteCount as number) ?? 0;
  const participationRate = (drep?.participationRate as number) ?? 0;

  // Extract pool data
  const pool = poolRaw as Record<string, unknown> | undefined;
  const poolVoteCount = (pool?.voteCount as number) ?? 0;
  const poolIsGovActive = poolVoteCount > 0;

  // Coverage calculation (mirrors DelegationPage CoverageSummary logic)
  const hasDrep = !!delegatedDrep;
  const hasPool = !!delegatedPool;
  const coveredTypes = hasDrep ? 5 : 0;
  const poolCoveredTypes = hasPool && poolIsGovActive ? 2 : 0;
  const totalTypes = 7;
  const covered = coveredTypes + poolCoveredTypes;

  // Determine overall health
  let status: HealthStatus;
  let statusLabel: string;
  if (!hasDrep) {
    status = 'yellow';
    statusLabel = "You haven't delegated yet";
  } else if (!drepIsActive) {
    status = 'red';
    statusLabel = 'Representative inactive';
  } else if (participationRate < 30) {
    status = 'yellow';
    statusLabel = 'Low participation';
  } else if (covered < totalTypes && !hasPool) {
    status = 'yellow';
    statusLabel = 'Partial coverage';
  } else {
    status = 'green';
    statusLabel = 'Healthy';
  }

  const statusColors = {
    green: {
      icon: ShieldCheck,
      iconColor: 'text-emerald-500',
      badgeCls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    yellow: {
      icon: ShieldAlert,
      iconColor: 'text-amber-500',
      badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    red: {
      icon: ShieldX,
      iconColor: 'text-red-500',
      badgeCls: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
  };

  const { icon: StatusIcon, iconColor, badgeCls } = statusColors[status];

  // Epoch countdown (uses mountTime captured in state to satisfy purity rules)
  const SHELLEY_GENESIS = 1596491091;
  const EPOCH_LEN = 432000;
  const BASE_EPOCH = 209;
  const currentEpoch = BASE_EPOCH + Math.floor((mountTime - SHELLEY_GENESIS) / EPOCH_LEN);
  const nextEpochStart = SHELLEY_GENESIS + (currentEpoch + 1 - BASE_EPOCH) * EPOCH_LEN;
  const daysUntilNext = Math.max(0, Math.ceil((nextEpochStart - mountTime) / 86400));

  // Auto-abstain and no-confidence special states
  const isAutoAbstain = delegatedDrep === 'drep_always_abstain';
  const isNoConfidence = delegatedDrep === 'drep_always_no_confidence';

  return (
    <Card className="border-white/[0.08] bg-card/15 backdrop-blur-md py-0">
      <CardContent className="space-y-3 py-4 px-4 sm:px-5">
        {/* Header row: status + badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('h-4 w-4', iconColor)} />
            <span className="text-sm font-semibold text-foreground">Delegation Health</span>
          </div>
          <Badge
            variant="outline"
            className={cn('text-[10px] font-semibold uppercase tracking-wider', badgeCls)}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* DRep status */}
        {hasDrep && !isAutoAbstain && !isNoConfidence && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">DRep</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate max-w-[140px]">{drepName}</span>
              <span
                className={cn('tabular-nums', drepIsActive ? 'text-emerald-400' : 'text-red-400')}
              >
                {drepIsActive ? 'Active' : 'Inactive'}
              </span>
              {drepIsActive && (
                <>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="tabular-nums text-muted-foreground">
                    {drepVoteCount} vote{drepVoteCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {isAutoAbstain && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>
              Delegated to <strong>Always Abstain</strong> — your ADA is registered but won&apos;t
              vote.
            </span>
          </div>
        )}

        {isNoConfidence && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span>
              Delegated to <strong>No Confidence</strong> — signals distrust of current governance.
            </span>
          </div>
        )}

        {/* Pool status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pool</span>
          <div className="flex items-center gap-2">
            {hasPool ? (
              <>
                <Server className="h-3 w-3 text-muted-foreground" />
                <span
                  className={cn(
                    'tabular-nums',
                    poolIsGovActive ? 'text-emerald-400' : 'text-amber-400',
                  )}
                >
                  {poolIsGovActive ? 'Participating' : 'Not participating'}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground/60">Not delegated</span>
            )}
          </div>
        </div>

        {/* Coverage */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Coverage</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="tabular-nums font-medium text-foreground cursor-help border-b border-dotted border-muted-foreground/30">
                  {covered}/{totalTypes} decision types
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] space-y-1.5 py-2.5 px-3">
                <p className="font-semibold text-[11px]">7 governance decision types in Cardano</p>
                <ol className="list-decimal list-inside text-[10px] leading-relaxed space-y-0.5 opacity-90">
                  <li>Constitutional Committee updates</li>
                  <li>Constitutional changes</li>
                  <li>Hard fork initiation</li>
                  <li>Protocol parameter changes</li>
                  <li>Treasury withdrawals</li>
                  <li>Info actions</li>
                  <li>No confidence motions</li>
                </ol>
                <p className="text-[10px] opacity-70 pt-0.5">
                  Your DRep covers 5 types. Your staking pool can cover the remaining 2.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Next check */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <Clock className="h-3 w-3" />
            <span>
              Next check: {epochDateRange(currentEpoch + 1)} ({daysUntilNext}d)
            </span>
          </div>
        </div>

        {/* Action links when health is not green */}
        {status !== 'green' && (
          <div className="flex items-center gap-3 pt-1">
            {(!hasDrep || !drepIsActive || isAutoAbstain || isNoConfidence) && (
              <Link
                href={!hasDrep ? '/match' : `/drep/${encodeURIComponent(delegatedDrep!)}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {!hasDrep ? 'Find a representative' : 'Review your DRep'}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {(!hasPool || !poolIsGovActive) && hasDrep && (
              <Link
                href="/match"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Find a match
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
