'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { computeTier } from '@/lib/scoring/tiers';

type PickerMode = 'drep' | 'spo' | 'cc';

interface AdminViewAsPickerProps {
  mode: PickerMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  titleOverride?: string;
  descriptionOverride?: string;
}

interface DRepItem {
  drepId: string;
  name?: string | null;
  ticker?: string | null;
  drepScore?: number | null;
  isActive?: boolean;
}

interface PoolItem {
  poolId: string;
  poolName?: string | null;
  ticker?: string | null;
  governanceScore?: number | null;
}

interface CCMemberItem {
  ccHotId: string;
  name?: string | null;
  fidelityGrade?: string | null;
  voteCount?: number;
}

function useDRepList(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-view-as-dreps'],
    queryFn: async () => {
      const res = await fetch('/api/dreps');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.allDReps ?? []) as DRepItem[];
    },
    enabled,
    staleTime: 120_000,
  });
}

function usePoolList(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-view-as-pools'],
    queryFn: async () => {
      const res = await fetch('/api/governance/pools');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.pools ?? []) as PoolItem[];
    },
    enabled,
    staleTime: 120_000,
  });
}

function useCCMemberList(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-view-as-cc'],
    queryFn: async () => {
      const res = await fetch('/api/governance/committee');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.members ?? []) as CCMemberItem[];
    },
    enabled,
    staleTime: 120_000,
  });
}

function truncateId(id: string) {
  if (id.length <= 20) return id;
  return `${id.slice(0, 12)}...${id.slice(-6)}`;
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">--</span>;
  const tier = computeTier(score);
  const colors: Record<string, string> = {
    Emerging: 'text-muted-foreground',
    Bronze: 'text-amber-700 dark:text-amber-500',
    Silver: 'text-slate-500 dark:text-slate-400',
    Gold: 'text-yellow-600 dark:text-yellow-400',
    Diamond: 'text-cyan-600 dark:text-cyan-400',
    Legendary: 'text-purple-600 dark:text-purple-400',
  };
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${colors[tier] ?? 'text-muted-foreground'}`}
    >
      {Math.round(score)}
    </span>
  );
}

export function AdminViewAsPicker({
  mode,
  open,
  onOpenChange,
  onSelect,
  titleOverride,
  descriptionOverride,
}: AdminViewAsPickerProps) {
  const [search, setSearch] = useState('');
  const { data: dreps, isLoading: drepsLoading } = useDRepList(open && mode === 'drep');
  const { data: pools, isLoading: poolsLoading } = usePoolList(open && mode === 'spo');
  const { data: ccMembers, isLoading: ccLoading } = useCCMemberList(open && mode === 'cc');

  const isLoading = mode === 'drep' ? drepsLoading : mode === 'spo' ? poolsLoading : ccLoading;

  const filteredDreps = useMemo(() => {
    if (mode !== 'drep' || !dreps) return [];
    const q = search.toLowerCase().trim();
    if (!q) return dreps.slice(0, 100);
    return dreps
      .filter(
        (d) =>
          d.drepId.toLowerCase().includes(q) ||
          d.name?.toLowerCase().includes(q) ||
          d.ticker?.toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [mode, dreps, search]);

  const filteredPools = useMemo(() => {
    if (mode !== 'spo' || !pools) return [];
    const q = search.toLowerCase().trim();
    if (!q) return pools.slice(0, 100);
    return pools
      .filter(
        (p) =>
          p.poolId.toLowerCase().includes(q) ||
          p.poolName?.toLowerCase().includes(q) ||
          p.ticker?.toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [mode, pools, search]);

  const filteredCC = useMemo(() => {
    if (mode !== 'cc' || !ccMembers) return [];
    const q = search.toLowerCase().trim();
    if (!q) return ccMembers;
    return ccMembers.filter(
      (m) => m.ccHotId.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q),
    );
  }, [mode, ccMembers, search]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
    setSearch('');
  };

  const defaultTitles: Record<PickerMode, string> = {
    drep: 'Select a DRep',
    spo: 'Select a Stake Pool',
    cc: 'Select a CC Member',
  };
  const defaultDescriptions: Record<PickerMode, string> = {
    drep: 'View the app as this DRep. Sorted by score.',
    spo: 'View the app as this SPO. Sorted by governance score.',
    cc: 'View the app as this committee member.',
  };
  const searchPlaceholders: Record<PickerMode, string> = {
    drep: 'Search by name or ID...',
    spo: 'Search by ticker, name, or ID...',
    cc: 'Search by name or ID...',
  };
  const title = titleOverride ?? defaultTitles[mode];
  const description = descriptionOverride ?? defaultDescriptions[mode];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSearch('');
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholders[mode]}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto min-h-0 max-h-[50vh] -mx-2 px-2">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : mode === 'drep' ? (
            filteredDreps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No DReps found.</p>
            ) : (
              <div className="space-y-0.5 py-1">
                {filteredDreps.map((d) => (
                  <button
                    key={d.drepId}
                    onClick={() => handleSelect(d.drepId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {d.name || d.ticker || truncateId(d.drepId)}
                      </div>
                      {(d.name || d.ticker) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {truncateId(d.drepId)}
                        </div>
                      )}
                    </div>
                    <ScoreBadge score={d.drepScore} />
                  </button>
                ))}
              </div>
            )
          ) : mode === 'spo' ? (
            filteredPools.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pools found.</p>
            ) : (
              <div className="space-y-0.5 py-1">
                {filteredPools.map((p) => (
                  <button
                    key={p.poolId}
                    onClick={() => handleSelect(p.poolId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.ticker
                          ? `[${p.ticker}] ${p.poolName || ''}`.trim()
                          : p.poolName || truncateId(p.poolId)}
                      </div>
                      {(p.poolName || p.ticker) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {truncateId(p.poolId)}
                        </div>
                      )}
                    </div>
                    <ScoreBadge score={p.governanceScore} />
                  </button>
                ))}
              </div>
            )
          ) : filteredCC.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No committee members found.
            </p>
          ) : (
            <div className="space-y-0.5 py-1">
              {filteredCC.map((m) => (
                <button
                  key={m.ccHotId}
                  onClick={() => handleSelect(m.ccHotId)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.name || truncateId(m.ccHotId)}
                    </div>
                    {m.name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {truncateId(m.ccHotId)}
                      </div>
                    )}
                  </div>
                  {m.fidelityGrade && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {m.fidelityGrade}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
