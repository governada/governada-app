'use client';

import { useState, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  TableProperties,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Search as SearchIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  GovernadaSPOCard,
  getPoolStrengths,
  type GovernadaSPOData,
} from '@/components/governada/cards/GovernadaSPOCard';
import { computeTier } from '@/lib/scoring/tiers';
import {
  TIER_SCORE_COLOR,
  TIER_LEFT_ACCENT,
  tierKey,
} from '@/components/governada/cards/tierStyles';
import { useQuery } from '@tanstack/react-query';
import { PeekTrigger } from '@/components/governada/peeks/PeekTrigger';
import { usePeekTrigger } from '@/components/governada/peeks/PeekDrawerProvider';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';
import { MatchAwareDiscoverHero } from './MatchAwareDiscoverHero';
import { CompassGuide } from '@/components/governada/shared/CompassGuide';
import { InsightCard } from '@/components/governada/shared/InsightCard';
import { PersonalTeaser } from '@/components/governada/shared/PersonalTeaser';
import { AdvisorTeaser } from '@/components/governada/shared/AdvisorTeaser';

/* ── Constants ──────────────────────────────────────────────────── */

const TIER_CHIPS: { value: string; label: string; tooltip?: string }[] = [
  { value: 'All', label: 'All' },
  {
    value: 'Emerging',
    label: 'Emerging',
    tooltip: 'Score 0-39. Pools beginning their governance journey.',
  },
  {
    value: 'Bronze',
    label: 'Bronze',
    tooltip: 'Score 40-54. Pools with initial governance activity.',
  },
  {
    value: 'Silver',
    label: 'Silver',
    tooltip: 'Score 55-69. Pools with consistent governance participation.',
  },
  {
    value: 'Gold',
    label: 'Gold',
    tooltip: 'Score 70-84. Active pools with strong voting records.',
  },
  { value: 'Diamond', label: 'Diamond', tooltip: 'Score 85-94. Top-tier governance engagement.' },
  { value: 'Legendary', label: 'Legendary', tooltip: 'Score 95-100. Elite governance leaders.' },
];

const STATUS_CHIPS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'registered', label: 'Active' },
  { value: 'retiring', label: 'Retiring' },
  { value: 'retired', label: 'Retired' },
];

type ViewMode = 'cards' | 'table';
const VIEW_MODE_KEY = 'governada_spo_view';
const CARD_PAGE_SIZE = 24;
const TABLE_PAGE_SIZE = 50;

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'cards';
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'table' || stored === 'cards') return stored;
  } catch {}
  return 'cards';
}

interface FilterState {
  search: string;
  tier: string;
  status: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  tier: 'All',
  status: 'all',
};

/* ── Data hook ──────────────────────────────────────────────────── */

function usePools() {
  return useQuery({
    queryKey: ['governada-pools'],
    queryFn: () =>
      fetch('/api/governance/pools')
        .then((r) => (r.ok ? r.json() : { pools: [] }))
        .then((d) => d.pools ?? []),
    staleTime: 120_000,
  });
}

/* ── Table row component ────────────────────────────────────────── */

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(ada);
}

function SPOTableRow({
  pool,
  rank,
  onPeek,
}: {
  pool: GovernadaSPOData;
  rank: number;
  onPeek?: () => void;
}) {
  const score = pool.governanceScore ?? 0;
  const tier = tierKey(computeTier(score));
  const momentum = pool.scoreMomentum ?? null;
  const strengths = getPoolStrengths(pool);

  const displayName = pool.ticker
    ? pool.ticker
    : pool.poolName || `${pool.poolId.slice(0, 16)}\u2026`;

  const subtitle =
    pool.ticker && pool.poolName && pool.poolName !== pool.ticker ? pool.poolName : null;

  return (
    <Link
      href={`/pool/${pool.poolId}`}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-all duration-200',
        TIER_LEFT_ACCENT[tier],
      )}
    >
      {/* Rank */}
      <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums w-6 text-right shrink-0">
        #{rank}
      </span>

      {/* Score pill */}
      <div className="shrink-0 flex flex-col items-center w-10">
        <span className={cn('text-lg font-bold tabular-nums leading-none', TIER_SCORE_COLOR[tier])}>
          {score}
        </span>
        <span
          className={cn(
            'text-[8px] font-semibold uppercase tracking-wider mt-0.5',
            TIER_SCORE_COLOR[tier],
          )}
        >
          {tier === 'Emerging' ? 'NEW' : tier.slice(0, 3).toUpperCase()}
        </span>
      </div>

      {/* Name + stats */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground truncate">{displayName}</span>
          {subtitle && (
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[180px]">
              {subtitle}
            </span>
          )}
          {strengths.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {strengths.map((label) => (
                <span
                  key={label}
                  className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {pool.voteCount} vote{pool.voteCount !== 1 ? 's' : ''}
          </span>
          {pool.participationPct != null && (
            <span className="tabular-nums">
              \u00b7 {Math.round(pool.participationPct)}% participation
            </span>
          )}
          {pool.delegatorCount > 0 && (
            <span className="hidden sm:inline tabular-nums">
              \u00b7 {pool.delegatorCount.toLocaleString()} delegators
            </span>
          )}
          {pool.liveStakeAda > 0 && (
            <span className="hidden sm:inline tabular-nums">
              \u00b7 \u20b3{formatAda(pool.liveStakeAda)}
            </span>
          )}
        </div>
      </div>

      {/* Momentum */}
      <span className="shrink-0">
        {momentum !== null && momentum > 0.5 ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
        ) : momentum !== null && momentum < -0.5 ? (
          <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
        ) : (
          <Minus className="h-3 w-3 text-muted-foreground/40" />
        )}
      </span>

      {onPeek && <PeekTrigger onClick={onPeek} ariaLabel={`Preview ${displayName}`} />}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

/* ── Main browse component ──────────────────────────────────────── */

export function GovernadaSPOBrowse() {
  const contentRef = useRef<HTMLDivElement>(null);
  const openPeek = usePeekTrigger();
  const { data: rawPools, isLoading } = usePools();
  const pools: GovernadaSPOData[] = useMemo(
    () => (rawPools as GovernadaSPOData[]) ?? [],
    [rawPools],
  );
  const { isAtLeast } = useGovernanceDepth();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const deferredSearch = useDeferredValue(filters.search);
  const pageSize = viewMode === 'table' ? TABLE_PAGE_SIZE : CARD_PAGE_SIZE;

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(0);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {}
  };

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const isDefaultFilters =
    filters.search === '' && filters.tier === 'All' && filters.status === 'all';

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = pools;

    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.ticker?.toLowerCase().includes(q) ||
          p.poolName?.toLowerCase().includes(q) ||
          p.poolId.toLowerCase().includes(q),
      );
    }

    if (filters.tier !== 'All') {
      result = result.filter((p) => computeTier(p.governanceScore ?? 0) === filters.tier);
    }

    if (filters.status !== 'all') {
      result = result.filter((p) => (p.poolStatus ?? 'registered') === filters.status);
    }

    return result;
  }, [pools, deferredSearch, filters]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // Determine if search hit the "governance-active only" boundary
  const searchHasResults = !deferredSearch.trim() || filtered.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Hands-Off: match-aware discovery hero ──────────────────────────
  if (!isAtLeast('informed')) {
    const poolEntities = pools.map((p) => ({
      id: p.poolId,
      name: p.ticker || p.poolName || `${p.poolId.slice(0, 16)}\u2026`,
      score: p.governanceScore ?? 0,
      participationPct: p.participationPct ?? null,
      alignmentTreasuryConservative: p.alignmentTreasuryConservative,
      alignmentTreasuryGrowth: p.alignmentTreasuryGrowth,
      alignmentDecentralization: p.alignmentDecentralization,
      alignmentSecurity: p.alignmentSecurity,
      alignmentInnovation: p.alignmentInnovation,
      alignmentTransparency: p.alignmentTransparency,
    }));
    return (
      <MatchAwareDiscoverHero
        entityType="spo"
        entities={poolEntities}
        isLoading={isLoading}
        totalCount={pools.length}
      />
    );
  }

  if (!pools.length) {
    return (
      <div className="pt-16 text-center space-y-2 text-muted-foreground text-sm">
        <p>No governance-active pools found.</p>
        <p className="text-xs opacity-60">
          Pools appear here once they vote on governance actions.
        </p>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="space-y-3">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight">Stake Pool Governance</h1>
          <span className="text-xs text-muted-foreground shrink-0">
            {pools.length > 0 ? `${pools.length} governance-active pools` : ''}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          How are stake pools participating in Cardano governance? Find pools that vote actively and
          align with your values.
        </p>
      </div>

      <CompassGuide page="pools" poolCount={pools.length} />

      {/* ── Sticky filter bar ────────────────────────────────────── */}
      <div className="sticky top-10 lg:top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-card/60 backdrop-blur-xl border-b border-border/30">
        <DiscoverFilterBar
          search={filters.search}
          onSearchChange={(v) => setFilter('search', v)}
          searchPlaceholder="Search ticker, pool name, or ID\u2026"
          chipGroups={[
            {
              label: 'Tier',
              value: filters.tier,
              options: TIER_CHIPS,
              onChange: (v) => setFilter('tier', v),
            },
            {
              label: 'Status',
              value: filters.status,
              options: STATUS_CHIPS,
              onChange: (v) => setFilter('status', v),
            },
          ]}
          resultCount={filtered.length}
          totalCount={pools.length}
          entityLabel="pools"
          isFiltered={!isDefaultFilters}
          onReset={resetFilters}
          pageInfo={totalPages > 1 ? `Page ${page + 1} / ${totalPages}` : undefined}
        />

        {/* View toggle toolbar */}
        <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/20">
          <div className="hidden sm:flex items-center gap-0.5">
            <button
              onClick={() => toggleViewMode('cards')}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'cards'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => toggleViewMode('table')}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'table'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Table view"
            >
              <TableProperties className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      {pageItems.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          {!searchHasResults ? (
            <>
              <div className="flex justify-center mb-2">
                <SearchIcon className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground text-sm">
                No pool found matching &ldquo;{deferredSearch}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-md mx-auto">
                Only pools that have voted on governance actions are shown here. If you&apos;re
                looking for a specific pool, they may not have participated in governance yet.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No pools match your filters.</p>
          )}
          {!isDefaultFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div key={page} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((pool, i) => (
            <div
              key={pool.poolId}
              className="group/card relative animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
              style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
            >
              <GovernadaSPOCard pool={pool} rank={page * pageSize + i + 1} />
              {openPeek && (
                <PeekTrigger
                  onClick={() => openPeek({ type: 'pool', id: pool.poolId })}
                  ariaLabel={`Preview ${pool.ticker || pool.poolName || pool.poolId.slice(0, 12)}`}
                  className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100"
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 divide-y divide-border/50 overflow-hidden bg-card/40 backdrop-blur-md">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="w-6 text-right shrink-0">#</span>
            <span className="w-10 text-center shrink-0">Score</span>
            <span className="flex-1">Pool</span>
            <span className="w-5 shrink-0" />
            <span className="w-3.5 shrink-0" />
          </div>
          {pageItems.map((pool, i) => (
            <SPOTableRow
              key={pool.poolId}
              pool={pool}
              rank={page * pageSize + i + 1}
              onPeek={openPeek ? () => openPeek({ type: 'pool', id: pool.poolId }) : undefined}
            />
          ))}
        </div>
      )}

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />

      <PersonalTeaser variant="pool_comparison" />

      <InsightCard
        insight="Stake pools with governance scores above 70 tend to have more stable delegator bases — governance participation signals operator commitment."
        category="participation"
      />

      <AdvisorTeaser />
    </div>
  );
}
