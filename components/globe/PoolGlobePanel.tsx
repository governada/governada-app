'use client';

/**
 * PoolGlobePanel — SPO pool detail for the globe panel overlay.
 *
 * Enhanced version of PoolPeek with richer data display.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Users, Vote, ShieldCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/governada/cards/tierStyles';
import type { GovernadaSPOData } from '@/components/governada/cards/GovernadaSPOCard';
import { getPoolStrengths } from '@/components/governada/cards/GovernadaSPOCard';
import { PillarBar } from './panelShared';

interface PoolGlobePanelProps {
  poolId: string;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(ada);
}

export function PoolGlobePanel({ poolId }: PoolGlobePanelProps) {
  const { data: pools, isLoading } = useQuery<GovernadaSPOData[]>({
    queryKey: ['governada-pools'],
    queryFn: () =>
      fetch('/api/governance/pools')
        .then((r) => (r.ok ? r.json() : { pools: [] }))
        .then((d) => d.pools ?? []),
    staleTime: 120_000,
  });

  const pool = useMemo(() => {
    if (!pools) return null;
    return pools.find((p) => p.poolId === poolId) ?? null;
  }, [pools, poolId]);

  if (isLoading || !pool) {
    return <PanelSkeleton />;
  }

  const score = pool.governanceScore ?? 0;
  const tier = tierKey(computeTier(score));
  const displayName = pool.ticker || pool.poolName || `${pool.poolId.slice(0, 16)}...`;
  const subtitle =
    pool.ticker && pool.poolName && pool.poolName !== pool.ticker ? pool.poolName : null;
  const strengths = getPoolStrengths(pool);
  const isClaimed = !!pool.claimedBy;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Stake Pool Operator
        </p>
        <h3 className="text-lg font-semibold leading-snug">{displayName}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        <div className="flex items-center gap-2">
          <span className={cn('text-3xl font-bold tabular-nums', TIER_SCORE_COLOR[tier])}>
            {score}
          </span>
          <span
            className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', TIER_BADGE_BG[tier])}
          >
            {tier}
          </span>
          {isClaimed && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox icon={Users} value={pool.delegatorCount.toLocaleString()} label="Delegators" />
        <StatBox icon={Vote} value={String(pool.voteCount)} label="Votes" />
      </div>

      {/* Live stake */}
      <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-center">
        <span className="text-xs text-muted-foreground">Live Stake</span>
        <span className="text-lg font-bold tabular-nums block">
          {'\u20B3'}
          {formatAda(pool.liveStakeAda)}
        </span>
      </div>

      {/* Score breakdown */}
      <div className="space-y-1.5 rounded-lg border border-border/30 bg-muted/10 p-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Score Breakdown
        </span>
        <PillarBar label="Participation" value={pool.participationPct} />
        <PillarBar label="Deliberation" value={pool.deliberationPct ?? null} />
        <PillarBar label="Reliability" value={pool.reliabilityPct ?? null} />
        <PillarBar label="Gov Identity" value={pool.governanceIdentityPct ?? null} />
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {strengths.map((s) => (
            <span
              key={s}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Open full link */}
      <Link
        href={`/pool/${pool.poolId}`}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg',
          'text-sm font-medium transition-colors',
          'bg-primary/10 text-primary hover:bg-primary/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
      >
        Open full profile
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground block">{label}</span>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
