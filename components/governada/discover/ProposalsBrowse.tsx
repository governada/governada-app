'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { CircleDot, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useProposals, useDRepVotes } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet-context';
import { ProposalStatusFunnel } from '@/components/governada/charts/ProposalStatusFunnel';
import type { VotesResponseData, VoteItem } from '@/types/api';
import { AnonymousNudge } from '@/components/governada/shared/AnonymousNudge';
import { useDepthConfig } from '@/hooks/useDepthConfig';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { DepthGate } from '@/components/providers/DepthGate';
import { getProposalTheme, getVerdict } from '@/components/governada/proposals/proposal-theme';
import { ProposalCard } from './ProposalCard';
import type { BrowseProposal } from './ProposalCard';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { DiscoverPagination } from './DiscoverPagination';

const STATUS_FILTERS = ['All', 'Open', 'Ratified', 'Enacted', 'Expired', 'Dropped'];
const TYPE_FILTERS = [
  { value: 'All', label: 'All types' },
  { value: 'ParameterChange', label: 'Rule Change' },
  { value: 'HardForkInitiation', label: 'Major Upgrade' },
  { value: 'TreasuryWithdrawals', label: 'Spending' },
  { value: 'NewConstitution', label: 'Rules Update' },
  { value: 'NoConfidence', label: 'Leadership Challenge' },
  { value: 'UpdateCommittee', label: 'Committee' },
  { value: 'InfoAction', label: 'Statement' },
];

const PAGE_SIZE = 25;

/* ── Hands-Off: ultra-compact status-only summary ─────────────────────────── */
function ProposalStatusSummary({ proposals }: { proposals: BrowseProposal[] }) {
  const counts: Record<string, number> = {};
  for (const p of proposals) {
    const s = p.status ?? 'Open';
    counts[s] = (counts[s] || 0) + 1;
  }
  const active = counts['Open'] ?? 0;
  const decided =
    (counts['Ratified'] ?? 0) +
    (counts['Enacted'] ?? 0) +
    (counts['Expired'] ?? 0) +
    (counts['Dropped'] ?? 0);

  return (
    <div className="space-y-3" data-discovery="gov-proposals">
      <h1 className="text-xl font-bold tracking-tight">What&apos;s Being Decided</h1>
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold">
              {active}
            </span>
            <span className="text-sm text-muted-foreground">active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted/40 text-muted-foreground text-sm font-bold">
              {decided}
            </span>
            <span className="text-sm text-muted-foreground">decided</span>
          </div>
        </div>
        {/* Show most recent open proposals as compact clickable rows */}
        {proposals
          .filter((p) => (p.status ?? 'Open').toLowerCase() === 'open')
          .slice(0, 3)
          .map((p) => {
            const theme = p.type ? getProposalTheme(p.type) : null;
            const TypeIcon = theme?.icon;
            return (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposal/${p.txHash}/${p.index}`}
                className="group flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors -mx-1"
              >
                {TypeIcon && <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                <span className="flex-1 text-sm truncate text-muted-foreground group-hover:text-foreground transition-colors">
                  {p.title || `${p.txHash?.slice(0, 16)}\u2026`}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
              </Link>
            );
          })}
        <Link
          href="/governance/proposals"
          className="text-xs text-primary hover:underline"
          onClick={(e) => {
            // Prevent navigation loop — we're already on this page, just prompt depth change
            e.preventDefault();
          }}
        >
          See all proposals &rarr;
        </Link>
      </div>
    </div>
  );
}

/* ── Informed: headline card for proposals ─────────────────────────────────── */
function ProposalHeadlineCard({
  proposal: p,
  drepVote,
  animationDelay,
}: {
  proposal: BrowseProposal;
  drepVote?: string;
  animationDelay: number;
}) {
  const theme = p.type ? getProposalTheme(p.type) : null;
  const TypeIcon = theme?.icon;
  const verdict = getVerdict((p.status ?? 'Open').toLowerCase(), p.triBody);
  const title = p.title || `${p.txHash?.slice(0, 16)}\u2026`;

  const VOTE_PILL: Record<string, { label: string; cls: string }> = {
    Yes: { label: 'Yes', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    No: { label: 'No', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    Abstain: { label: 'Abstain', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  };
  const pill = drepVote ? VOTE_PILL[drepVote] : null;

  return (
    <Link
      href={`/proposal/${p.txHash}/${p.index}`}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card/70 backdrop-blur-md hover:bg-muted/40 hover:border-border/70 hover:shadow-sm transition-all duration-200 animate-in fade-in fill-mode-backwards"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {TypeIcon && <TypeIcon className="h-4 w-4 shrink-0" style={{ color: theme?.accent }} />}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate block">{title}</span>
        <span className="text-[11px] text-muted-foreground">
          {theme?.label ?? 'Governance Action'}
        </span>
      </div>
      {pill && (
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${pill.cls}`}
        >
          DRep: {pill.label}
        </span>
      )}
      <span
        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${verdict.color} ${verdict.bgColor} ${verdict.borderColor}`}
      >
        {verdict.label}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    </Link>
  );
}

export function ProposalsBrowse() {
  const contentRef = useRef<HTMLDivElement>(null);
  const { data: rawData, isLoading } = useProposals(200);
  const data = rawData as { proposals?: BrowseProposal[]; currentEpoch?: number } | undefined;
  const proposals: BrowseProposal[] = useMemo(() => data?.proposals ?? [], [data]);
  const currentEpoch: number | null = data?.currentEpoch ?? null;
  const { delegatedDrepId } = useWallet();
  const { data: drepVotesRaw } = useDRepVotes(delegatedDrepId);
  const depthConfig = useDepthConfig('governance');
  const { isAtLeast } = useGovernanceDepth();

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

  // ── Hands-Off: compact status summary only ──────────────────────────────
  if (depthConfig.proposalDetail === 'headline' && !isAtLeast('informed')) {
    return <ProposalStatusSummary proposals={proposals} />;
  }

  // ── Informed: headline card list (title + status + DRep position) ───────
  const isInformedOnly = depthConfig.proposalDetail === 'summary';

  return (
    <div ref={contentRef} className="space-y-3" data-discovery="gov-proposals">
      {/* Page heading */}
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">What&apos;s Being Decided</h1>
        <span className="text-xs text-muted-foreground shrink-0">
          {delegatedDrepId && depthConfig.showDRepPosition
            ? "Your representative's votes shown"
            : ''}
        </span>
      </div>

      <AnonymousNudge variant="proposals" />

      {/* Status pipeline overview — Informed+ */}
      {statusCounts.length > 1 && (
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Governance Pipeline
          </p>
          <ProposalStatusFunnel statuses={statusCounts} />
        </div>
      )}

      {/* Filters — Engaged+ get search/filter bar */}
      <DepthGate minDepth="engaged">
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
      </DepthGate>

      {/* Needs attention banner — Engaged+ (requires rationale awareness) */}
      <DepthGate minDepth="engaged">
        {needsAttentionCount > 0 &&
          (statusFilter === 'All' || statusFilter === 'Open') &&
          page === 0 && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <CircleDot className="h-4 w-4 text-violet-400 shrink-0" />
              <span className="text-sm text-muted-foreground">
                Your representative hasn&apos;t voted on{' '}
                <strong className="text-violet-300">{needsAttentionCount}</strong> open proposal
                {needsAttentionCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
      </DepthGate>

      {/* Proposal cards — density varies by depth */}
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
      ) : isInformedOnly ? (
        /* Informed: compact headline cards — title, status, DRep position */
        <div key={page} className="space-y-2">
          {pageItems.map((p, i: number) => (
            <ProposalHeadlineCard
              key={`${p.txHash}-${p.index}`}
              proposal={p}
              drepVote={
                depthConfig.showDRepPosition ? drepVoteMap.get(`${p.txHash}:${p.index}`) : undefined
              }
              animationDelay={Math.min(i, 14) * 30}
            />
          ))}
        </div>
      ) : (
        /* Engaged / Deep: full proposal cards */
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

      {/* Deep: historical context placeholder */}
      <DepthGate minDepth="deep">
        {/* TODO: Phase 6+ — Historical proposal context, trend analysis, cross-epoch comparisons */}
        <div className="rounded-xl border border-dashed border-border/40 bg-card/30 p-4 text-center">
          <p className="text-xs text-muted-foreground/60">
            Historical proposal trends and cross-epoch analysis coming soon
          </p>
        </div>
      </DepthGate>

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  );
}
