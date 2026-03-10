'use client';

import { TrendingUp, TrendingDown, Minus, Users, Trophy } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  useDRepReportCard,
  useDashboardDelegatorTrends,
  useSPOPoolCompetitive,
  useSPODelegatorTrends,
} from '@/hooks/queries';
import { HubCard, HubCardSkeleton, HubCardError } from './HubCard';

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

/**
 * DRep Delegator Status Card
 *
 * JTBD: "How many people trust me to represent them?"
 * One number + trend, links to /workspace/delegators.
 */
export function DRepDelegatorsCard() {
  const { drepId } = useSegment();
  const { data: trendsRaw, isLoading, isError, refetch } = useDashboardDelegatorTrends(drepId);

  if (isLoading) return <HubCardSkeleton />;
  if (isError)
    return <HubCardError message="Couldn't load delegator data" onRetry={() => refetch()} />;

  const trends = trendsRaw as Record<string, unknown> | undefined;
  const currentCount = (trends?.currentCount as number) ?? 0;
  const change = (trends?.change as number) ?? 0;

  return (
    <HubCard
      href="/workspace/delegators"
      urgency="default"
      label={`${currentCount} delegators, ${change >= 0 ? '+' : ''}${change} recent change`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Delegators
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">
            {currentCount.toLocaleString()} delegator{currentCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <TrendIcon value={change} />
          <span className="tabular-nums font-medium">
            {change >= 0 ? '+' : ''}
            {change}
          </span>
        </div>
      </div>
    </HubCard>
  );
}

/**
 * DRep Score Status Card
 *
 * JTBD: "How am I doing as a DRep?"
 * Score + trend + tier, links to /workspace/performance.
 */
export function DRepScoreCard() {
  const { drepId } = useSegment();
  const { data: reportRaw, isLoading, isError, refetch } = useDRepReportCard(drepId);

  if (isLoading) return <HubCardSkeleton />;
  if (isError) return <HubCardError message="Couldn't load your score" onRetry={() => refetch()} />;

  const report = reportRaw as Record<string, unknown> | undefined;
  const score = Math.round((report?.score as number) ?? 0);
  const tier = (report?.tier as string) ?? 'Emerging';
  const trend = (report?.trend as number) ?? 0;

  return (
    <HubCard
      href="/workspace/performance"
      urgency="default"
      label={`Score ${score}, ${tier} tier, ${trend >= 0 ? 'up' : 'down'} ${Math.abs(trend)}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your Score
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">{tier} tier</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums text-foreground">{score}</span>
          <div className="flex items-center justify-end gap-1 text-xs">
            <TrendIcon value={trend} />
            <span className="tabular-nums">
              {trend >= 0 ? '+' : ''}
              {trend.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </HubCard>
  );
}

/**
 * SPO Governance Score Card
 *
 * JTBD: "What's my governance reputation?"
 * Score + rank + trend, links to /workspace.
 */
export function SPOGovernanceScoreCard() {
  const { poolId } = useSegment();
  const { data: competitiveRaw, isLoading, isError, refetch } = useSPOPoolCompetitive(poolId);

  if (isLoading) return <HubCardSkeleton />;
  if (isError)
    return <HubCardError message="Couldn't load governance score" onRetry={() => refetch()} />;

  const competitive = competitiveRaw as Record<string, unknown> | undefined;
  const pool = competitive?.pool as Record<string, unknown> | undefined;
  const score = Math.round((pool?.governance_score as number) ?? 0);
  const rank = (competitive?.rank as number) ?? 0;
  const totalPools = (competitive?.totalPools as number) ?? 0;
  const percentile = Math.round((competitive?.percentile as number) ?? 0);
  const scoreHistory = (competitive?.scoreHistory as { governance_score: number }[]) ?? [];
  const trend =
    scoreHistory.length >= 2
      ? scoreHistory[0].governance_score - scoreHistory[scoreHistory.length - 1].governance_score
      : 0;

  return (
    <HubCard
      href="/workspace"
      urgency="default"
      label={`Governance score ${score}, rank ${rank} of ${totalPools}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Governance Score
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">Top {percentile}% of pools</p>
          <p className="text-xs text-muted-foreground">
            Rank {rank} of {totalPools}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums text-foreground">{score}</span>
          <div className="flex items-center justify-end gap-1 text-xs">
            <TrendIcon value={trend} />
          </div>
        </div>
      </div>
    </HubCard>
  );
}

/**
 * SPO Delegator Changes Card (conditional)
 *
 * Only shows when there are meaningful delegator changes.
 * Links to /workspace/delegators.
 */
export function SPODelegatorsCard() {
  const { poolId } = useSegment();
  const { data: trendsRaw, isLoading, isError, refetch } = useSPODelegatorTrends(poolId);

  if (isLoading) return <HubCardSkeleton />;
  if (isError)
    return <HubCardError message="Couldn't load delegator changes" onRetry={() => refetch()} />;

  const trends = trendsRaw as Record<string, unknown> | undefined;
  const currentCount = (trends?.totalDelegators as number) ?? 0;
  const change = (trends?.change as number) ?? 0;

  // Don't render if no meaningful change
  if (change === 0) return null;

  return (
    <HubCard
      href="/workspace/delegators"
      urgency={change < 0 ? 'warning' : 'default'}
      label={`${currentCount} delegators, ${change >= 0 ? '+' : ''}${change} change`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Delegator Changes
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">
            {change > 0
              ? `+${change} new delegator${change !== 1 ? 's' : ''}`
              : `${change} delegator${Math.abs(change) !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
    </HubCard>
  );
}
