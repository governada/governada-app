'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CivicaSPOCard } from '@/components/civica/cards/CivicaSPOCard';
import { computeTier } from '@/lib/scoring/tiers';
import { useQuery } from '@tanstack/react-query';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';

const TIER_CHIPS = ['All', 'Emerging', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Legendary'];
const PAGE_SIZE = 24;

function usePools() {
  return useQuery({
    queryKey: ['civica-pools'],
    queryFn: () =>
      fetch('/api/governance/pools')
        .then((r) => (r.ok ? r.json() : { pools: [] }))
        .then((d) => d.pools ?? []),
    staleTime: 120_000,
  });
}

export function CivicaSPOBrowse() {
  const { data: rawPools, isLoading } = usePools();
  const pools: any[] = useMemo(() => rawPools ?? [], [rawPools]);

  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('All');
  const [claimedOnly, setClaimedOnly] = useState(false);
  const [page, setPage] = useState(0);

  const isDefault = search === '' && tier === 'All' && !claimedOnly;

  const resetFilters = () => {
    setSearch('');
    setTier('All');
    setClaimedOnly(false);
    setPage(0);
  };

  const setFilter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(0);
    };

  const filtered = useMemo(() => {
    let result = pools;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p: any) =>
          p.ticker?.toLowerCase().includes(q) ||
          p.poolName?.toLowerCase().includes(q) ||
          p.poolId.toLowerCase().includes(q),
      );
    }

    if (tier !== 'All') {
      result = result.filter((p: any) => computeTier(p.governanceScore ?? 0) === tier);
    }

    if (claimedOnly) {
      result = result.filter((p: any) => !!p.claimedBy);
    }

    return result;
  }, [pools, search, tier, claimedOnly]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
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
    <div className="space-y-4 pt-4">
      <DiscoverFilterBar
        search={search}
        onSearchChange={setFilter(setSearch)}
        searchPlaceholder="Search ticker, pool name, or ID…"
        chipGroups={[
          {
            label: 'Tier',
            value: tier,
            options: TIER_CHIPS.map((t) => ({ value: t, label: t })),
            onChange: setFilter(setTier),
          },
        ]}
        toggles={[
          { label: 'Claimed only', checked: claimedOnly, onChange: setFilter(setClaimedOnly) },
        ]}
        resultCount={filtered.length}
        totalCount={pools.length}
        entityLabel="pools"
        isFiltered={!isDefault}
        onReset={resetFilters}
        pageInfo={totalPages > 1 ? `Page ${page + 1} / ${totalPages}` : undefined}
      />

      {/* Card grid */}
      {pageItems.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No pools match your filters.
        </div>
      ) : (
        <div key={page} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((pool: any, i: number) => (
            <div
              key={pool.poolId}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
              style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
            >
              <CivicaSPOCard pool={pool} rank={page * PAGE_SIZE + i + 1} />
            </div>
          ))}
        </div>
      )}

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
