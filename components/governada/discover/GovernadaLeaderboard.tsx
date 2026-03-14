'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/governada/cards/tierStyles';
import { useGovernanceLeaderboard } from '@/hooks/queries';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';
import type { LeaderboardData, LeaderboardEntry, HallOfFameEntry } from '@/types/api';

const PAGE_SIZE = 25;

const TIER_CHIPS = [
  { value: 'All', label: 'All' },
  { value: 'Bronze+', label: 'Bronze+' },
  { value: 'Silver+', label: 'Silver+' },
  { value: 'Gold+', label: 'Gold+' },
  { value: 'Diamond+', label: 'Diamond+' },
  { value: 'Legendary', label: 'Legendary' },
];

const TIER_MIN_SCORES: Record<string, number> = {
  All: 0,
  'Bronze+': 40,
  'Silver+': 55,
  'Gold+': 70,
  'Diamond+': 85,
  Legendary: 95,
};

const RANK_MEDALS: Record<number, string> = {
  1: '\u{1F947}',
  2: '\u{1F948}',
  3: '\u{1F949}',
};

export function GovernadaLeaderboard() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [tierFilter, setTierFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const { data: rawData, isLoading } = useGovernanceLeaderboard();
  const data = rawData as LeaderboardData | undefined;

  const allEntries: LeaderboardEntry[] = useMemo(() => data?.leaderboard ?? [], [data]);
  const weeklyMovers = useMemo<{ gainers: LeaderboardEntry[]; losers: LeaderboardEntry[] }>(
    () => ({
      gainers: data?.weeklyMovers?.gainers ?? [],
      losers: data?.weeklyMovers?.losers ?? [],
    }),
    [data],
  );

  const hallOfFame = useMemo<HallOfFameEntry[]>(
    () => (data?.hallOfFame as HallOfFameEntry[] | undefined) ?? [],
    [data],
  );

  const minScore = TIER_MIN_SCORES[tierFilter] ?? 0;
  const isDefault = tierFilter === 'All' && search === '';

  const resetFilters = () => {
    setTierFilter('All');
    setSearch('');
    setPage(0);
  };

  // Build delta map from movers
  const deltaMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of weeklyMovers.gainers) m.set(g.drepId ?? '', g.delta ?? 0);
    for (const l of weeklyMovers.losers) m.set(l.drepId ?? '', l.delta ?? 0);
    return m;
  }, [weeklyMovers]);

  const filtered = useMemo(() => {
    let result = allEntries.filter((e) => (e.score ?? 0) >= minScore);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) => e.name?.toLowerCase().includes(q) || e.drepId?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allEntries, minScore, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
    <div ref={contentRef} className="space-y-4 pt-4">
      <DiscoverFilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        searchPlaceholder="Search DRep name or ID…"
        chipGroups={[
          {
            label: 'Tier',
            value: tierFilter,
            options: TIER_CHIPS,
            onChange: (v) => {
              setTierFilter(v);
              setPage(0);
            },
          },
        ]}
        resultCount={filtered.length}
        totalCount={allEntries.length}
        entityLabel="DReps"
        isFiltered={!isDefault}
        onReset={resetFilters}
        pageInfo={totalPages > 1 ? `Page ${page + 1} / ${totalPages}` : undefined}
      />

      {/* Ranked list */}
      <div className="rounded-xl border border-border overflow-hidden">
        {pageEntries.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm space-y-1">
            <p>No DReps have reached {tierFilter} tier yet.</p>
            <p className="text-xs text-muted-foreground/70">
              Scores update every epoch as DReps participate in governance.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {pageEntries.map((entry, i: number) => {
              const globalRank = page * PAGE_SIZE + i + 1;
              const tier = tierKey(computeTier(entry.score ?? 0));
              const delta = deltaMap.get(entry.drepId ?? '');
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
                  <span className="w-8 text-sm font-bold tabular-nums text-center shrink-0">
                    {medal ?? (
                      <span className="text-muted-foreground font-normal">{globalRank}</span>
                    )}
                  </span>

                  <span className="flex-1 text-sm font-medium text-foreground truncate min-w-0">
                    {entry.name}
                    {!entry.isActive && (
                      <span className="ml-1 text-[10px] text-muted-foreground/70">(inactive)</span>
                    )}
                  </span>

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

                  <span className="w-4 shrink-0 flex justify-center">
                    {delta !== undefined && delta > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : delta !== undefined && delta < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                    ) : (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground/30" />
                    )}
                  </span>

                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0',
                      TIER_BADGE_BG[tier],
                    )}
                  >
                    {tier}
                  </span>

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

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />

      {/* Weekly movers strip */}
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
                <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                  Rising
                </p>
                {weeklyMovers.gainers.slice(0, 3).map((m) => (
                  <Link
                    key={m.drepId}
                    href={`/drep/${m.drepId}`}
                    className="flex items-center justify-between text-xs hover:text-primary transition-colors"
                  >
                    <span className="truncate text-foreground/80 max-w-[160px]">{m.name}</span>
                    <span className="text-emerald-400 font-medium tabular-nums shrink-0">
                      +{m.delta}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {weeklyMovers.losers.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-rose-400 font-medium uppercase tracking-wider">
                  Falling
                </p>
                {weeklyMovers.losers.slice(0, 3).map((m) => (
                  <Link
                    key={m.drepId}
                    href={`/drep/${m.drepId}`}
                    className="flex items-center justify-between text-xs hover:text-primary transition-colors"
                  >
                    <span className="truncate text-foreground/80 max-w-[160px]">{m.name}</span>
                    <span className="text-rose-400 font-medium tabular-nums shrink-0">
                      {m.delta}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hall of Fame */}
      {hallOfFame.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 space-y-3 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(110deg, transparent 30%, rgba(245,158,11,0.06) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 4s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
              Hall of Fame
            </p>
            <span className="text-[10px] text-muted-foreground ml-1">80+ score for 60+ days</span>
          </div>
          <div className="space-y-1">
            {hallOfFame.map((entry) => (
              <Link
                key={entry.drepId}
                href={`/drep/${entry.drepId}`}
                className="flex items-center justify-between text-xs hover:text-primary transition-colors py-1"
              >
                <span className="truncate text-foreground/80 max-w-[200px]">{entry.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-amber-500/80 font-medium tabular-nums">{entry.days}d</span>
                  <span className="font-bold tabular-nums text-amber-500">{entry.score}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
