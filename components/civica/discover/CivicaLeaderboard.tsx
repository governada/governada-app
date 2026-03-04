'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { computeTier } from '@/lib/scoring/tiers';
import {
  TIER_SCORE_COLOR,
  TIER_BADGE_BG,
  TIER_BORDER,
  TIER_BG,
  tierKey,
  type TierKey,
} from '@/components/civica/cards/tierStyles';
import { useGovernanceLeaderboard } from '@/hooks/queries';

const PAGE_SIZE = 25;

const TIER_FILTERS: { label: string; min: number }[] = [
  { label: 'All', min: 0 },
  { label: 'Bronze+', min: 40 },
  { label: 'Silver+', min: 55 },
  { label: 'Gold+', min: 70 },
  { label: 'Diamond+', min: 85 },
  { label: 'Legendary', min: 95 },
];

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export function CivicaLeaderboard() {
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(0);

  // Fetch max 50 results (API cap); filter by tier client-side
  const { data: rawData, isLoading } = useGovernanceLeaderboard();
  const data = rawData as any;

  const allEntries: any[] = data?.leaderboard ?? [];
  const weeklyMovers: { gainers: any[]; losers: any[] } = data?.weeklyMovers ?? {
    gainers: [],
    losers: [],
  };

  // Build delta map from movers
  const deltaMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of weeklyMovers.gainers) m.set(g.drepId, g.delta);
    for (const l of weeklyMovers.losers) m.set(l.drepId, l.delta);
    return m;
  }, [weeklyMovers]);

  const filtered = useMemo(
    () => allEntries.filter((e: any) => e.score >= minScore),
    [allEntries, minScore],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleTierFilter = (min: number) => {
    setMinScore(min);
    setPage(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* ── Tier filter chips ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {TIER_FILTERS.map(({ label, min }) => (
          <button
            key={label}
            onClick={() => handleTierFilter(min)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
              minScore === min
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {filtered.length} DReps
        </span>
      </div>

      {/* ── Ranked list ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        {pageEntries.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No DReps in this tier range yet.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {pageEntries.map((entry: any, i: number) => {
              const globalRank = page * PAGE_SIZE + i + 1;
              const tier = tierKey(computeTier(entry.score));
              const delta = deltaMap.get(entry.drepId);
              const medal = RANK_MEDALS[globalRank];

              return (
                <Link
                  key={entry.drepId}
                  href={`/drep/${entry.drepId}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    'hover:bg-muted/30',
                  )}
                >
                  {/* Rank */}
                  <span className="w-8 text-sm font-bold tabular-nums text-center shrink-0">
                    {medal ?? (
                      <span className="text-muted-foreground font-normal">
                        {globalRank}
                      </span>
                    )}
                  </span>

                  {/* Name */}
                  <span className="flex-1 text-sm font-medium text-foreground truncate min-w-0">
                    {entry.name}
                    {!entry.isActive && (
                      <span className="ml-1 text-[10px] text-muted-foreground/50">(inactive)</span>
                    )}
                  </span>

                  {/* Delta (weekly trend) */}
                  <span className="w-14 text-right shrink-0">
                    {delta !== undefined ? (
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums',
                          delta > 0 && 'text-emerald-400',
                          delta < 0 && 'text-rose-400',
                          delta === 0 && 'text-muted-foreground',
                        )}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </span>
                    ) : null}
                  </span>

                  {/* Trend icon */}
                  <span className="w-4 shrink-0 flex justify-center">
                    {delta !== undefined && delta > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : delta !== undefined && delta < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground/30" />
                    )}
                  </span>

                  {/* Tier badge */}
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0',
                      TIER_BADGE_BG[tier],
                    )}
                  >
                    {tier}
                  </span>

                  {/* Score */}
                  <span
                    className={cn(
                      'w-10 text-right font-display font-bold tabular-nums text-base shrink-0',
                      TIER_SCORE_COLOR[tier],
                    )}
                  >
                    {entry.score}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Weekly movers strip ──────────────────────────────── */}
      {(weeklyMovers.gainers.length > 0 || weeklyMovers.losers.length > 0) && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              7-day movers
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {weeklyMovers.gainers.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">Rising</p>
                {weeklyMovers.gainers.slice(0, 3).map((m: any) => (
                  <Link
                    key={m.drepId}
                    href={`/drep/${m.drepId}`}
                    className="flex items-center justify-between text-xs hover:text-primary transition-colors"
                  >
                    <span className="truncate text-foreground/80 max-w-[160px]">{m.name}</span>
                    <span className="text-emerald-400 font-medium tabular-nums shrink-0">+{m.delta}</span>
                  </Link>
                ))}
              </div>
            )}
            {weeklyMovers.losers.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-rose-400 font-medium uppercase tracking-wider">Falling</p>
                {weeklyMovers.losers.slice(0, 3).map((m: any) => (
                  <Link
                    key={m.drepId}
                    href={`/drep/${m.drepId}`}
                    className="flex items-center justify-between text-xs hover:text-primary transition-colors"
                  >
                    <span className="truncate text-foreground/80 max-w-[160px]">{m.name}</span>
                    <span className="text-rose-400 font-medium tabular-nums shrink-0">{m.delta}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
