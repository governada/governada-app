'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface PoolData {
  poolId: string;
  ticker: string | null;
  poolName: string | null;
  governanceScore: number | null;
  voteCount: number;
  participationPct: number | null;
  delegatorCount: number;
  liveStakeAda: number;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(ada);
}

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 70) return 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30';
  if (score >= 40) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
}

function PoolsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 space-y-3">
      <p className="text-muted-foreground text-sm">No SPO governance votes recorded yet.</p>
      <p className="text-xs text-muted-foreground/70">
        Stake pool operators will appear here once they participate in on-chain governance.
      </p>
    </div>
  );
}

export function PoolsDiscovery() {
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/governance/pools')
      .then((r) => (r.ok ? r.json() : { pools: [] }))
      .then((data) => setPools(data.pools || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PoolsSkeleton />;
  if (pools.length === 0) return <EmptyState />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pools.map((pool) => (
        <Link key={pool.poolId} href={`/pool/${pool.poolId}`}>
          <Card className="hover:border-cyan-500/40 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {pool.ticker ? (
                    <span className="font-semibold text-sm">{pool.ticker}</span>
                  ) : (
                    <span className="font-mono text-sm truncate">
                      {pool.poolId.slice(0, 16)}&hellip;
                    </span>
                  )}
                  {pool.poolName && pool.ticker && (
                    <p className="text-xs text-muted-foreground truncate">{pool.poolName}</p>
                  )}
                </div>
                {pool.governanceScore !== null ? (
                  <Badge
                    variant="outline"
                    className={`tabular-nums shrink-0 ${scoreColor(pool.governanceScore)}`}
                  >
                    {pool.governanceScore}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-cyan-500 border-cyan-500/40 shrink-0">
                    {pool.voteCount} votes
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{pool.voteCount} votes</span>
                {pool.participationPct !== null && (
                  <span>{pool.participationPct}% participation</span>
                )}
                {pool.delegatorCount > 0 && (
                  <span>{pool.delegatorCount.toLocaleString()} delegators</span>
                )}
                {pool.liveStakeAda > 0 && <span>{formatAda(pool.liveStakeAda)} ADA</span>}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
