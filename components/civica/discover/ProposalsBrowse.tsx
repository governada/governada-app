'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { CircleDot } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useProposals, useDRepVotes } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet-context';
import { ProposalStatusFunnel } from '@/components/civica/charts/ProposalStatusFunnel';
import type { VotesResponseData, VoteItem } from '@/types/api';
import { AnonymousNudge } from '@/components/civica/shared/AnonymousNudge';
import { ProposalCard } from './ProposalCard';
import type { BrowseProposal } from './ProposalCard';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';

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

const PAGE_SIZE = 25;

export function ProposalsBrowse() {
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: rawData, isLoading } = useProposals(200);
  const data = rawData as { proposals?: BrowseProposal[]; currentEpoch?: number } | undefined;
  const proposals: BrowseProposal[] = useMemo(() => data?.proposals ?? [], [data]);
  const currentEpoch: number | null = data?.currentEpoch ?? null;
  const { delegatedDrepId } = useWallet();
  const { data: drepVotesRaw } = useDRepVotes(delegatedDrepId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(0);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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
    const votesData = drepVotesRaw as VotesResponseData | undefined;
    const votes = votesData?.votes ?? (drepVotesRaw as VoteItem[] | undefined);
    if (Array.isArray(votes)) {
      for (const v of votes) {
        const key = `${v.proposalTxHash ?? ''}:${v.proposalIndex ?? ''}`;
        map.set(key, v.vote ?? v.voteDirection ?? '');
      }
    }
    return map;
  }, [drepVotesRaw]);

  const filtered = useMemo(() => {
    let r = proposals;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.txHash?.toLowerCase().includes(q) ||
          p.type?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'All') {
      r = r.filter((p) => (p.status ?? 'Open').toLowerCase() === statusFilter.toLowerCase());
    }
    if (typeFilter !== 'All') {
      r = r.filter((p) => p.type === typeFilter);
    }
    return r;
  }, [proposals, search, statusFilter, typeFilter]);

  // Count proposals needing the delegated DRep's vote
  const needsAttentionCount = useMemo(() => {
    if (!delegatedDrepId || drepVoteMap.size === 0) return 0;
    return proposals.filter((p) => {
      if ((p.status ?? 'Open').toLowerCase() !== 'open') return false;
      return !drepVoteMap.get(`${p.txHash}:${p.index}`);
    }).length;
  }, [proposals, delegatedDrepId, drepVoteMap]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of proposals) {
      const s = p.status ?? 'Open';
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
      <div className="space-y-3 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div ref={contentRef} className="space-y-3" data-discovery="gov-proposals">
      {/* Page heading */}
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">What&apos;s Being Decided</h1>
        <span className="text-xs text-muted-foreground shrink-0">
          {delegatedDrepId ? "Your DRep's votes shown" : ''}
        </span>
      </div>

      <AnonymousNudge variant="proposals" />

      {/* Status pipeline overview */}
      {statusCounts.length > 1 && (
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Governance Pipeline
          </p>
          <ProposalStatusFunnel statuses={statusCounts} />
        </div>
      )}

      <div className="sticky top-14 lg:top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-card/60 backdrop-blur-xl border-b border-border/30">
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
      </div>

      {/* Needs attention banner */}
      {needsAttentionCount > 0 &&
        (statusFilter === 'All' || statusFilter === 'Open') &&
        page === 0 && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
            <CircleDot className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="text-sm text-muted-foreground">
              Your DRep hasn&apos;t voted on{' '}
              <strong className="text-violet-300">{needsAttentionCount}</strong> open proposal
              {needsAttentionCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

      {/* Proposal cards */}
      {pageItems.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <p className="text-muted-foreground text-sm">No proposals match your filters.</p>
          <div className="flex gap-2 justify-center">
            {!isDefault && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear Filters
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/match">Try Quick Match &rarr;</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div key={page} className="space-y-3">
          {pageItems.map((p, i: number) => (
            <ProposalCard
              key={`${p.txHash}-${p.index}`}
              proposal={p}
              currentEpoch={currentEpoch}
              drepVote={drepVoteMap.get(`${p.txHash}:${p.index}`)}
              delegatedDrepId={delegatedDrepId}
              hasDrepVotes={drepVoteMap.size > 0}
              animationDelay={Math.min(i, 14) * 30}
            />
          ))}
        </div>
      )}

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  );
}
