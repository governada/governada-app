'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDReps } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { GitCompareArrows, Search, Check } from 'lucide-react';
import { useWallet } from '@/utils/wallet';

import { computeOverallAlignment } from '@/lib/alignment';
import type { EnrichedDRep } from '@/lib/koios';
import type { UserPrefKey } from '@/types/drep';

interface CompareButtonProps {
  currentDrepId: string;
  currentDrepName: string;
}

export function CompareButton({ currentDrepId, currentDrepName }: CompareButtonProps) {
  const router = useRouter();
  const { delegatedDrepId, connected } = useWallet();
  const [open, setOpen] = useState(false);
  const { data: drepsData, isLoading: loading } = useDReps();
  const allDreps = ((drepsData as any)?.dreps || []) as EnrichedDRep[];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const userPrefs = useMemo<UserPrefKey[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('drepscore_prefs');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.userPrefs || [];
      }
    } catch {
      /* ignore */
    }
    return [];
  }, []);

  const watchlist = useMemo<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('drepscore_watchlist');
      if (stored) return JSON.parse(stored);
    } catch {
      /* ignore */
    }
    return [];
  }, []);

  const sortedDreps = useMemo(() => {
    let list = allDreps.filter((d) => d.drepId !== currentDrepId);

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (d) =>
          d.name?.toLowerCase().includes(q) ||
          d.ticker?.toLowerCase().includes(q) ||
          d.drepId.toLowerCase().includes(q),
      );
    }

    const hasPrefs = userPrefs.length > 0;
    const watchSet = new Set(watchlist);

    if (hasPrefs) {
      const alignmentMap = new Map<string, number>();
      for (const d of list) {
        alignmentMap.set(d.drepId, computeOverallAlignment(d, userPrefs));
      }
      list.sort((a, b) => (alignmentMap.get(b.drepId) ?? 0) - (alignmentMap.get(a.drepId) ?? 0));
    } else if (watchlist.length > 0) {
      list.sort((a, b) => {
        const aW = watchSet.has(a.drepId) ? 1 : 0;
        const bW = watchSet.has(b.drepId) ? 1 : 0;
        if (aW !== bW) return bW - aW;
        return (b.drepScore ?? 0) - (a.drepScore ?? 0);
      });
    } else {
      list.sort((a, b) => (b.drepScore ?? 0) - (a.drepScore ?? 0));
    }

    return list.slice(0, 50);
  }, [allDreps, currentDrepId, query, userPrefs, watchlist]);

  const handleToggle = useCallback((drepId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(drepId)) {
        next.delete(drepId);
      } else if (next.size < 2) {
        next.add(drepId);
      } else {
        const first = next.values().next().value!;
        next.delete(first);
        next.add(drepId);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selected.size === 0) return;
    const ids = [currentDrepId, ...selected].join(',');
    setOpen(false);
    router.push(`/compare?dreps=${ids}`);
  }, [currentDrepId, selected, router]);

  const handleCompareWithYourDrep = useCallback(() => {
    if (!delegatedDrepId) return;
    router.push(`/compare?dreps=${delegatedDrepId},${currentDrepId}`);
  }, [delegatedDrepId, currentDrepId, router]);

  const showCompareWithYours = connected && delegatedDrepId && delegatedDrepId !== currentDrepId;

  return (
    <div className="flex items-center gap-2">
      {showCompareWithYours && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCompareWithYourDrep}
          className="text-xs gap-1.5"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          Compare with Your DRep
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Compare {currentDrepName} with…</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search DReps…"
                className="pl-8 h-9 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {userPrefs.length > 0 && !query && (
              <p className="text-[10px] text-muted-foreground">
                Sorted by alignment with your values
              </p>
            )}
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {loading && (
                <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
              )}
              {!loading &&
                sortedDreps.map((d) => (
                  <button
                    key={d.drepId}
                    className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between transition-colors ${
                      selected.has(d.drepId) ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                    onClick={() => handleToggle(d.drepId)}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="truncate block text-xs font-medium">
                        {d.name || d.drepId.slice(0, 20) + '…'}
                      </span>
                      {d.ticker && (
                        <span className="text-[10px] text-muted-foreground">${d.ticker}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline" className="text-[10px] tabular-nums">
                        {d.drepScore}
                      </Badge>
                      {selected.has(d.drepId) && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                ))}
              {!loading && sortedDreps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Search for DReps by name or ID to add them to comparison.
                </p>
              )}
            </div>
            <Button onClick={handleCompare} disabled={selected.size === 0} className="w-full gap-2">
              <GitCompareArrows className="h-4 w-4" />
              Compare {selected.size + 1} DReps
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
