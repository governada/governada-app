'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RotateCcw, LayoutGrid, TableProperties, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CivicaDRepCard } from '@/components/civica/cards/CivicaDRepCard';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/civica/cards/tierStyles';
import type { EnrichedDRep } from '@/lib/koios';
import { ScoreDistribution } from '@/components/civica/charts/ScoreDistribution';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';
import {
  loadMatchProfile,
  alignmentDistance,
  distanceToMatchScore,
  type StoredMatchProfile,
} from '@/lib/matchStore';
import type { AlignmentScores } from '@/lib/drepIdentity';

const TIER_CHIPS = ['All', 'Emerging', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Legendary'];

const ALIGNMENT_OPTIONS = [
  { value: 'all', label: 'Any alignment' },
  { value: 'treasury_conservative', label: 'Fiscal conservative' },
  { value: 'treasury_growth', label: 'Growth-oriented' },
  { value: 'decentralization', label: 'Decentralization' },
  { value: 'security', label: 'Security-focused' },
  { value: 'innovation', label: 'Innovation-first' },
  { value: 'transparency', label: 'Transparency' },
];

const ALIGNMENT_FIELD_MAP: Record<string, keyof EnrichedDRep> = {
  treasury_conservative: 'alignmentTreasuryConservative',
  treasury_growth: 'alignmentTreasuryGrowth',
  decentralization: 'alignmentDecentralization',
  security: 'alignmentSecurity',
  innovation: 'alignmentInnovation',
  transparency: 'alignmentTransparency',
};

type ViewMode = 'cards' | 'table';
const VIEW_MODE_KEY = 'civica_drep_view';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'cards';
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'table' || stored === 'cards') return stored;
  } catch {}
  return window.innerWidth >= 768 ? 'cards' : 'cards';
}

const CARD_PAGE_SIZE = 24;
const TABLE_PAGE_SIZE = 50;

interface FilterState {
  search: string;
  tier: string;
  activeOnly: boolean;
  alignment: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  tier: 'All',
  activeOnly: false,
  alignment: 'all',
};

interface CivicaDRepBrowseProps {
  dreps: EnrichedDRep[];
  totalAvailable?: number;
}

function DRepTableRow({ drep, rank }: { drep: EnrichedDRep; rank: number }) {
  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const displayName = drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 16)}…`;

  return (
    <Link
      href={`/drep/${drep.drepId}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
    >
      <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums w-6 text-right shrink-0">
        #{rank}
      </span>
      <span className="flex-1 text-sm font-medium truncate min-w-0">{displayName}</span>
      <span
        className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
          TIER_BADGE_BG[tier],
          TIER_SCORE_COLOR[tier],
        )}
      >
        {score}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums w-14 text-right shrink-0">
        {Math.round(drep.effectiveParticipation ?? 0)}% part.
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right shrink-0">
        {drep.delegatorCount.toLocaleString()}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}

type SortMode = 'score' | 'match';

export function CivicaDRepBrowse({ dreps }: CivicaDRepBrowseProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  // Load match profile from localStorage (lazy init — no effect needed)
  const sortParam = searchParams.get('sort');
  const [matchProfile] = useState<StoredMatchProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    return loadMatchProfile();
  });
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'score';
    return sortParam === 'match' && loadMatchProfile() ? 'match' : 'score';
  });

  const pageSize = viewMode === 'table' ? TABLE_PAGE_SIZE : CARD_PAGE_SIZE;

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setPage(0);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {}
  };

  const isDefaultFilters =
    filters.search === '' &&
    filters.tier === 'All' &&
    !filters.activeOnly &&
    filters.alignment === 'all';

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = dreps;

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name?.toLowerCase().includes(q) ||
          d.ticker?.toLowerCase().includes(q) ||
          d.handle?.toLowerCase().includes(q) ||
          d.drepId.toLowerCase().includes(q),
      );
    }

    if (filters.tier !== 'All') {
      result = result.filter((d) => computeTier(d.drepScore ?? 0) === filters.tier);
    }

    if (filters.activeOnly) {
      result = result.filter((d) => d.isActive);
    }

    if (filters.alignment !== 'all') {
      const field = ALIGNMENT_FIELD_MAP[filters.alignment];
      if (field) {
        result = result.filter((d) => {
          const vals = ALIGNMENT_FIELD_MAP;
          const all = Object.values(vals).map((f) => (d as any)[f] as number | null);
          const dominant = all.reduce<[string, number]>(
            (best, v, i) => {
              const dim = Object.keys(vals)[i];
              return v !== null && v > best[1] ? [dim, v] : best;
            },
            ['', -1],
          );
          return dominant[0] === filters.alignment;
        });
      }
    }

    // Sort by match compatibility if enabled and profile exists
    if (sortMode === 'match' && matchProfile) {
      const userAlign = matchProfile.userAlignments;
      result = [...result].sort((a, b) => {
        const aAlign: AlignmentScores = {
          treasuryConservative: a.alignmentTreasuryConservative,
          treasuryGrowth: a.alignmentTreasuryGrowth,
          decentralization: a.alignmentDecentralization,
          security: a.alignmentSecurity,
          innovation: a.alignmentInnovation,
          transparency: a.alignmentTransparency,
        };
        const bAlign: AlignmentScores = {
          treasuryConservative: b.alignmentTreasuryConservative,
          treasuryGrowth: b.alignmentTreasuryGrowth,
          decentralization: b.alignmentDecentralization,
          security: b.alignmentSecurity,
          innovation: b.alignmentInnovation,
          transparency: b.alignmentTransparency,
        };
        return alignmentDistance(userAlign, aAlign) - alignmentDistance(userAlign, bAlign);
      });
    }

    return result;
  }, [dreps, filters, sortMode, matchProfile]);

  const allScores = useMemo(() => dreps.map((d) => d.drepScore ?? 0), [dreps]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4 pt-4">
      {/* Score distribution overview */}
      {dreps.length > 10 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Score Distribution
          </p>
          <ScoreDistribution scores={allScores} />
        </div>
      )}

      <DiscoverFilterBar
        search={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        searchPlaceholder="Search by name, ticker, or ID…"
        chipGroups={[
          {
            label: 'Tier',
            value: filters.tier,
            options: TIER_CHIPS.map((t) => ({ value: t, label: t })),
            onChange: (v) => setFilter('tier', v),
          },
          {
            label: 'Alignment',
            value: filters.alignment,
            options: ALIGNMENT_OPTIONS,
            onChange: (v) => setFilter('alignment', v),
          },
        ]}
        toggles={[
          {
            label: 'Active DReps only',
            checked: filters.activeOnly,
            onChange: (v) => setFilter('activeOnly', v),
          },
        ]}
        resultCount={filtered.length}
        totalCount={dreps.length}
        entityLabel="DReps"
        isFiltered={!isDefaultFilters}
        onReset={resetFilters}
        pageInfo={totalPages > 1 ? `Page ${page + 1} / ${totalPages}` : undefined}
      />

      {/* Match sort banner + view mode toggle */}
      {matchProfile && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortMode(sortMode === 'match' ? 'score' : 'match')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              sortMode === 'match'
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {sortMode === 'match' ? 'Sorted by match' : 'Sort by match'}
          </button>
          {sortMode === 'match' && (
            <span className="text-xs text-muted-foreground">
              Based on your{' '}
              <Link href="/match" className="text-primary hover:underline">
                governance profile
              </Link>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-1">
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
          <LayoutGrid className="h-4 w-4" />
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
          <TableProperties className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      {pageItems.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-muted-foreground text-sm">No DReps match your filters.</p>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Clear filters
          </Button>
        </div>
      ) : viewMode === 'cards' ? (
        <div key={page} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((drep, i) => {
            let ms: number | null = null;
            if (sortMode === 'match' && matchProfile) {
              const dAlign: AlignmentScores = {
                treasuryConservative: drep.alignmentTreasuryConservative,
                treasuryGrowth: drep.alignmentTreasuryGrowth,
                decentralization: drep.alignmentDecentralization,
                security: drep.alignmentSecurity,
                innovation: drep.alignmentInnovation,
                transparency: drep.alignmentTransparency,
              };
              ms = distanceToMatchScore(alignmentDistance(matchProfile.userAlignments, dAlign));
            }
            return (
              <div
                key={drep.drepId}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
              >
                <CivicaDRepCard
                  drep={drep}
                  rank={sortMode === 'match' ? undefined : page * pageSize + i + 1}
                  matchScore={ms}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="w-6 text-right shrink-0">#</span>
            <span className="flex-1">Name</span>
            <span className="shrink-0">Score</span>
            <span className="w-14 text-right shrink-0">Particip.</span>
            <span className="w-12 text-right shrink-0">Deleg.</span>
            <span className="w-3.5 shrink-0" />
          </div>
          {pageItems.map((drep, i) => (
            <DRepTableRow key={drep.drepId} drep={drep} rank={page * pageSize + i + 1} />
          ))}
        </div>
      )}

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
