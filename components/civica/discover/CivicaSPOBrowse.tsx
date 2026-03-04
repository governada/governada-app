'use client';

import { useState, useMemo } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CivicaSPOCard } from '@/components/civica/cards/CivicaSPOCard';
import { computeTier } from '@/lib/scoring/tiers';
import { useQuery } from '@tanstack/react-query';

const TIER_CHIPS = ['All', 'Emerging', 'Bronze', 'Silver', 'Gold', 'Diamond', 'Legendary'];

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
  const pools: any[] = rawPools ?? [];

  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('All');
  const [claimedOnly, setClaimedOnly] = useState(false);

  const isDefault = search === '' && tier === 'All' && !claimedOnly;

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
      result = result.filter(
        (p: any) => computeTier(p.governanceScore ?? 0) === tier,
      );
    }

    if (claimedOnly) {
      result = result.filter((p: any) => !!p.claimedBy);
    }

    return result;
  }, [pools, search, tier, claimedOnly]);

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
        <p className="text-xs opacity-60">Pools appear here once they vote on governance actions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* ── Search + tier chips ──────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search ticker, pool name, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => { setSearch(''); setTier('All'); setClaimedOnly(false); }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TIER_CHIPS.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                tier === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={claimedOnly}
              onChange={(e) => setClaimedOnly(e.target.checked)}
              className="h-3 w-3 rounded accent-primary"
            />
            Claimed only
          </label>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing{' '}
        <strong className="text-foreground">{filtered.length}</strong>
        {!isDefault && ` of ${pools.length}`} pools
      </p>

      {/* ── Grid ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No pools match your filters.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((pool: any, i: number) => (
            <CivicaSPOCard
              key={pool.poolId}
              pool={pool}
              rank={i + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
