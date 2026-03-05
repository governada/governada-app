'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { CivicaDRepCard } from '@/components/civica/cards/CivicaDRepCard';
import { computeTier } from '@/lib/scoring/tiers';
import type { EnrichedDRep } from '@/lib/koios';
import { ScoreDistribution } from '@/components/civica/charts/ScoreDistribution';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';

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

const PAGE_SIZE = 24;

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

export function CivicaDRepBrowse({ dreps }: CivicaDRepBrowseProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);

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

    return result;
  }, [dreps, filters]);

  const allScores = useMemo(() => dreps.map((d) => d.drepScore ?? 0), [dreps]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

      {/* Card grid */}
      {pageItems.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-muted-foreground text-sm">No DReps match your filters.</p>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((drep, i) => (
            <CivicaDRepCard key={drep.drepId} drep={drep} rank={page * PAGE_SIZE + i + 1} />
          ))}
        </div>
      )}

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
