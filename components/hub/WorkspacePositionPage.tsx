'use client';

import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSPOPoolCompetitive } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Neighbor {
  poolId: string;
  ticker?: string;
  poolName?: string;
  rank?: number;
  score?: number;
  isTarget?: boolean;
}

/**
 * WorkspacePositionPage — SPO competitive landscape.
 *
 * JTBD: "Where do I rank among other pools?"
 * Shows rank, percentile, and neighboring pools.
 */
export function WorkspacePositionPage() {
  const { segment, poolId } = useSegment();
  const { data: compRaw, isLoading } = useSPOPoolCompetitive(poolId);

  if (segment !== 'spo') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">This page is for SPOs.</p>
        <Button asChild>
          <Link href="/">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const competitive = compRaw as Record<string, unknown> | undefined;
  const rank = (competitive?.rank as number) ?? 0;
  const totalPools = (competitive?.totalPools as number) ?? 0;
  const percentile = Math.round((competitive?.percentile as number) ?? 0);
  const neighbors = (competitive?.neighbors as Neighbor[]) ?? [];
  const pool = competitive?.pool as Record<string, unknown> | undefined;
  const score = Math.round((pool?.governance_score as number) ?? 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6" data-discovery="spo-position">
      <div className="flex items-center gap-3">
        <Link
          href="/workspace"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Competitive Position</h1>
      </div>

      {/* Position summary */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your Rank
              </span>
            </div>
            <p className="text-3xl font-bold tabular-nums text-foreground">#{rank}</p>
            <p className="text-sm text-muted-foreground">
              of {totalPools} governance-active pools &middot; Top {percentile}%
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold tabular-nums text-foreground">{score}</span>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
        </div>
      </div>

      {/* Neighbors leaderboard */}
      {neighbors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Nearby Pools
          </h3>
          {neighbors.map((n) => (
            <Link
              key={n.poolId}
              href={`/pool/${encodeURIComponent(n.poolId)}`}
              className={cn(
                'flex items-center justify-between rounded-xl border p-3 transition-colors hover:border-primary/40',
                n.isTarget ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium tabular-nums text-muted-foreground w-8">
                  #{n.rank}
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {n.ticker ? `[${n.ticker}]` : n.poolName || n.poolId.slice(0, 12)}
                  {n.isTarget && <span className="ml-1.5 text-xs text-primary">(You)</span>}
                </span>
              </div>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {Math.round(n.score ?? 0)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
