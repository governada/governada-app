'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useProposals, useDRepVotes } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet-context';
import { ProposalStatusFunnel } from '@/components/civica/charts/ProposalStatusFunnel';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';

const TYPE_COLORS: Record<string, string> = {
  ParameterChange: 'bg-blue-950/30 text-blue-400 border-blue-800/30',
  HardForkInitiation: 'bg-orange-950/30 text-orange-400 border-orange-800/30',
  TreasuryWithdrawals: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/30',
  NewConstitution: 'bg-purple-950/30 text-purple-400 border-purple-800/30',
  NoConfidence: 'bg-rose-950/30 text-rose-400 border-rose-800/30',
  UpdateCommittee: 'bg-violet-950/30 text-violet-400 border-violet-800/30',
  InfoAction: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  Open: 'text-emerald-400',
  Ratified: 'text-sky-400',
  Enacted: 'text-violet-400',
  Dropped: 'text-muted-foreground',
  Expired: 'text-muted-foreground/70',
};

const STATUS_FILTERS = ['All', 'Open', 'Ratified', 'Enacted', 'Expired', 'Dropped'];
const TYPE_FILTERS = [
  { value: 'All', label: 'All types' },
  { value: 'ParameterChange', label: 'Param Change' },
  { value: 'HardForkInitiation', label: 'Hard Fork' },
  { value: 'TreasuryWithdrawals', label: 'Treasury' },
  { value: 'NewConstitution', label: 'Constitution' },
  { value: 'NoConfidence', label: 'No Confidence' },
  { value: 'UpdateCommittee', label: 'Committee' },
  { value: 'InfoAction', label: 'Info' },
];

function typeLabel(type: string): string {
  const found = TYPE_FILTERS.find((t) => t.value === type);
  return found?.label ?? type;
}

const VOTE_PILL: Record<string, { label: string; color: string }> = {
  Yes: { label: 'Yes', color: 'text-green-500 bg-green-500/10 border-green-500/20' },
  No: { label: 'No', color: 'text-red-500 bg-red-500/10 border-red-500/20' },
  Abstain: { label: 'Abstain', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
};

const PAGE_SIZE = 25;

export function ProposalsBrowse() {
  const { data: rawData, isLoading } = useProposals(200);
  const data = rawData as any;
  const proposals: any[] = useMemo(() => data?.proposals ?? [], [data]);
  const { delegatedDrepId } = useWallet();
  const { data: drepVotesRaw } = useDRepVotes(delegatedDrepId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(0);

  const isDefault = search === '' && statusFilter === 'All' && typeFilter === 'All';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setTypeFilter('All');
    setPage(0);
  };

  const setFilter =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(0);
    };

  // Build a lookup: "txHash:index" -> vote
  const drepVoteMap = useMemo(() => {
    const map = new Map<string, string>();
    const votes = (drepVotesRaw as any)?.votes ?? drepVotesRaw;
    if (Array.isArray(votes)) {
      for (const v of votes) {
        const key = `${v.proposal_tx_hash ?? v.proposalTxHash}:${v.proposal_index ?? v.proposalIndex}`;
        map.set(key, v.vote);
      }
    }
    return map;
  }, [drepVotesRaw]);

  const filtered = useMemo(() => {
    let r = proposals;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (p: any) =>
          p.title?.toLowerCase().includes(q) ||
          p.txHash?.toLowerCase().includes(q) ||
          p.type?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'All') {
      r = r.filter((p: any) => (p.status ?? 'Open').toLowerCase() === statusFilter.toLowerCase());
    }
    if (typeFilter !== 'All') {
      r = r.filter((p: any) => p.type === typeFilter);
    }
    return r;
  }, [proposals, search, statusFilter, typeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of proposals) {
      const s = (p as any).status ?? 'Open';
      counts[s] = (counts[s] || 0) + 1;
    }
    const STATUS_COLOR_MAP: Record<string, string> = {
      Open: '#34d399',
      Ratified: '#38bdf8',
      Enacted: '#a78bfa',
      Expired: '#64748b',
      Dropped: '#94a3b8',
    };
    return ['Open', 'Ratified', 'Enacted', 'Expired', 'Dropped']
      .filter((s) => (counts[s] || 0) > 0)
      .map((s) => ({ status: s, count: counts[s] || 0, color: STATUS_COLOR_MAP[s] || '#64748b' }));
  }, [proposals]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Status pipeline overview */}
      {statusCounts.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Governance Pipeline
          </p>
          <ProposalStatusFunnel statuses={statusCounts} />
        </div>
      )}

      <DiscoverFilterBar
        search={search}
        onSearchChange={setFilter(setSearch)}
        searchPlaceholder="Search proposals…"
        chipGroups={[
          {
            label: 'Status',
            value: statusFilter,
            options: STATUS_FILTERS.map((s) => ({ value: s, label: s })),
            onChange: setFilter(setStatusFilter),
          },
          {
            label: 'Type',
            value: typeFilter,
            options: TYPE_FILTERS,
            onChange: setFilter(setTypeFilter),
          },
        ]}
        resultCount={filtered.length}
        totalCount={proposals.length}
        entityLabel="proposals"
        isFiltered={!isDefault}
        onReset={resetFilters}
        pageInfo={totalPages > 1 ? `Page ${page + 1} / ${totalPages}` : undefined}
      />

      {/* List */}
      {pageItems.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No proposals match your search.
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
          {pageItems.map((p: any) => {
            const status = p.status ?? 'Open';
            const drepVote = drepVoteMap.get(`${p.txHash}:${p.index}`);
            const pill = drepVote ? VOTE_PILL[drepVote] : null;
            return (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposal/${p.txHash}/${p.index}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
              >
                {p.type && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                      TYPE_COLORS[p.type] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {typeLabel(p.type)}
                  </span>
                )}
                <span className="flex-1 text-sm text-foreground truncate min-w-0">
                  {p.title || `${p.txHash?.slice(0, 16)}…`}
                </span>
                {pill && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 hidden sm:inline',
                      pill.color,
                    )}
                    title={`Your DRep voted ${pill.label}`}
                  >
                    DRep: {pill.label}
                  </span>
                )}
                <span
                  className={cn(
                    'text-xs font-medium shrink-0',
                    STATUS_COLORS[status] ?? 'text-muted-foreground',
                  )}
                >
                  {status}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 group-hover:text-muted-foreground transition-colors" />
              </Link>
            );
          })}
        </div>
      )}

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
