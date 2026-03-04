'use client';

import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CivicaDRepCard } from '@/components/civica/cards/CivicaDRepCard';
import { computeTier } from '@/lib/scoring/tiers';
import type { EnrichedDRep } from '@/lib/koios';

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
  totalAvailable: number;
}

export function CivicaDRepBrowse({ dreps, totalAvailable }: CivicaDRepBrowseProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
        result = result
          .filter((d) => {
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4 pt-4">
      {/* ── Search + filter toggle row ───────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, ticker, or ID…"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="pl-9 h-9"
          />
          {filters.search && (
            <button
              onClick={() => setFilter('search', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant={filtersOpen ? 'default' : 'outline'}
          size="sm"
          className="h-9 shrink-0"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-1.5" />
          Filters
          {!isDefaultFilters && (
            <span className="ml-1.5 h-4 w-4 rounded-full bg-primary-foreground text-primary text-[9px] font-bold flex items-center justify-center">
              !
            </span>
          )}
        </Button>
      </div>

      {/* ── Expandable filter panel ──────────────────────────── */}
      {filtersOpen && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4 animate-in slide-in-from-top-2 duration-150">
          {/* Tier chips */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Score Tier
            </p>
            <div className="flex flex-wrap gap-2">
              {TIER_CHIPS.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter('tier', t)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                    filters.tier === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Alignment filter */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dominant Alignment
            </p>
            <div className="flex flex-wrap gap-2">
              {ALIGNMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter('alignment', opt.value)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                    filters.alignment === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active-only toggle + reset */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.activeOnly}
                onChange={(e) => setFilter('activeOnly', e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              <span className="text-xs text-foreground">Active DReps only</span>
            </label>

            {!isDefaultFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Results count ────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <strong className="text-foreground">{filtered.length}</strong>
          {!isDefaultFilters && ` of ${dreps.length}`} DReps
        </span>
        {totalPages > 1 && (
          <span>
            Page {page + 1} / {totalPages}
          </span>
        )}
      </div>

      {/* ── Card grid ────────────────────────────────────────── */}
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
            <CivicaDRepCard
              key={drep.drepId}
              drep={drep}
              rank={page * PAGE_SIZE + i + 1}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
              const pg = totalPages <= 7 ? idx : idx === 0 ? 0 : idx === 6 ? totalPages - 1 : page - 2 + idx;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={cn(
                    'h-7 w-7 text-xs rounded-md border transition-colors',
                    pg === page
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {pg + 1}
                </button>
              );
            })}
          </div>
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
    </div>
  );
}
