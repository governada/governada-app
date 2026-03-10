'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  Landmark,
  Users,
  Shield,
  Scale,
  AlertTriangle,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useProposals, useDRepVotes } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet-context';
import { ProposalStatusFunnel } from '@/components/civica/charts/ProposalStatusFunnel';
import type { VotesResponseData, VoteItem } from '@/types/api';

interface BrowseProposal {
  txHash: string;
  index: number;
  title?: string;
  type?: string;
  status?: string;
  expirationEpoch?: number;
  withdrawalAmount?: number;
  treasuryPct?: number;
  deliveryStatus?: string;
  deliveryScore?: number;
  triBody?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
  relevantPrefs?: string[];
  [key: string]: unknown;
}
import { ProposalDeliveryBadge } from '@/components/civica/proposals/ProposalDeliveryBadge';
import type { DeliveryStatus } from '@/lib/proposalOutcomes';
import { AnonymousNudge } from '@/components/civica/shared/AnonymousNudge';
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

function formatAdaShort(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

function formatPct(pct: number): string {
  if (pct < 0.01) return '<0.01%';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

const PREF_LABELS: Record<string, { label: string; color: string }> = {
  'treasury-conservative': { label: 'Treasury', color: 'text-red-400 bg-red-500/10' },
  'smart-treasury-growth': { label: 'Growth', color: 'text-emerald-400 bg-emerald-500/10' },
  'strong-decentralization': { label: 'Decentral', color: 'text-purple-400 bg-purple-500/10' },
  'protocol-security-first': { label: 'Security', color: 'text-blue-400 bg-blue-500/10' },
  'innovation-defi-growth': { label: 'Innovation', color: 'text-cyan-400 bg-cyan-500/10' },
  'responsible-governance': { label: 'Transparency', color: 'text-amber-400 bg-amber-500/10' },
};

function TriBodyMini({
  triBody,
}: {
  triBody: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
}) {
  const bodies = [
    { label: 'DRep', data: triBody.drep, icon: Users },
    { label: 'SPO', data: triBody.spo, icon: Shield },
    { label: 'CC', data: triBody.cc, icon: Scale },
  ] as const;

  return (
    <div className="flex items-center gap-2">
      {bodies.map(({ label, data, icon: Icon }) => {
        const total = data.yes + data.no + data.abstain;
        if (total === 0) return null;
        const yesPct = Math.round((data.yes / total) * 100);
        const color =
          yesPct >= 60 ? 'text-green-500' : yesPct >= 40 ? 'text-amber-500' : 'text-red-500';
        return (
          <span
            key={label}
            className="flex items-center gap-0.5 text-[10px]"
            title={`${label}: ${data.yes}Y / ${data.no}N / ${data.abstain}A`}
          >
            <Icon className="h-2.5 w-2.5 text-muted-foreground" />
            <span className={cn('font-semibold tabular-nums', color)}>{yesPct}%</span>
          </span>
        );
      })}
    </div>
  );
}

function getConsensusLabel(triBody: {
  drep: { yes: number; no: number; abstain: number };
  spo: { yes: number; no: number; abstain: number };
  cc: { yes: number; no: number; abstain: number };
}): { label: string; color: string } | null {
  const bodies = [triBody.drep, triBody.spo, triBody.cc];
  const activeBodies = bodies.filter((b) => b.yes + b.no + b.abstain > 0);
  if (activeBodies.length < 2) return null;
  const yesPcts = activeBodies.map((b) => {
    const total = b.yes + b.no + b.abstain;
    return total > 0 ? b.yes / total : 0;
  });
  const allHigh = yesPcts.every((p) => p >= 0.6);
  const allLow = yesPcts.every((p) => p < 0.4);
  const mixed = yesPcts.some((p) => p >= 0.6) && yesPcts.some((p) => p < 0.4);
  if (allHigh) return { label: 'Consensus', color: 'text-emerald-400' };
  if (allLow) return { label: 'Opposed', color: 'text-rose-400' };
  if (mixed) return { label: 'Contested', color: 'text-amber-400' };
  return null;
}

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
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div ref={contentRef} className="space-y-4 pt-4">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">What&apos;s Being Decided</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {delegatedDrepId
            ? 'Active governance proposals and how your representative voted'
            : 'Active governance proposals in Cardano'}
        </p>
      </div>

      <AnonymousNudge variant="proposals" />

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
        <div
          key={page}
          className="rounded-xl border border-border divide-y divide-border/50 overflow-hidden"
        >
          {pageItems.map((p, i: number) => {
            const status = p.status ?? 'Open';
            const drepVote = drepVoteMap.get(`${p.txHash}:${p.index}`);
            const pill = drepVote ? VOTE_PILL[drepVote] : null;
            const epochsLeft =
              status === 'Open' && currentEpoch && p.expirationEpoch
                ? p.expirationEpoch - currentEpoch
                : null;
            const hasTreasury = p.type === 'TreasuryWithdrawals' && p.withdrawalAmount;
            return (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposal/${p.txHash}/${p.index}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/30 transition-colors group animate-in fade-in duration-200 fill-mode-backwards"
                style={{ animationDelay: `${Math.min(i, 14) * 20}ms` }}
              >
                {/* Row 1: Type + Title + Status */}
                <div className="flex items-center gap-3">
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
                  <span
                    className={cn(
                      'text-xs font-medium shrink-0',
                      STATUS_COLORS[status] ?? 'text-muted-foreground',
                    )}
                  >
                    {status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70 shrink-0 group-hover:text-muted-foreground transition-colors" />
                </div>

                {/* Row 2: Metadata chips */}
                <div className="flex items-center gap-3 pl-0 sm:pl-[calc(1.5rem+0.75rem)] flex-wrap">
                  {hasTreasury && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                      <Landmark className="h-2.5 w-2.5" />
                      <span className="font-semibold tabular-nums">
                        {formatAdaShort(p.withdrawalAmount ?? 0)} ADA
                      </span>
                      {p.treasuryPct != null && (
                        <span className="text-muted-foreground">
                          ({formatPct(p.treasuryPct * 100)})
                        </span>
                      )}
                    </span>
                  )}
                  {p.deliveryStatus && p.deliveryStatus !== 'unknown' && (
                    <ProposalDeliveryBadge
                      status={p.deliveryStatus as DeliveryStatus}
                      score={p.deliveryScore}
                      compact
                    />
                  )}
                  {p.triBody && <TriBodyMini triBody={p.triBody} />}
                  {p.triBody &&
                    (() => {
                      const consensus = getConsensusLabel(p.triBody);
                      if (!consensus) return null;
                      return (
                        <span className={cn('text-[10px] font-semibold', consensus.color)}>
                          {consensus.label}
                        </span>
                      );
                    })()}
                  {pill && (
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
                        pill.color,
                      )}
                      title={`Your DRep voted ${pill.label}`}
                    >
                      DRep: {pill.label}
                    </span>
                  )}
                  {!pill && status === 'Open' && delegatedDrepId && drepVoteMap.size > 0 && (
                    <span
                      className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border text-violet-400 bg-violet-500/10 border-violet-500/20 shrink-0"
                      title="Your DRep has not yet voted on this proposal"
                    >
                      <CircleDot className="h-2.5 w-2.5" />
                      Needs vote
                    </span>
                  )}
                  {epochsLeft != null && epochsLeft > 0 && (
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[10px]',
                        epochsLeft <= 2 ? 'text-amber-400 font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {epochsLeft <= 2 && <AlertTriangle className="h-2.5 w-2.5" />}
                      {epochsLeft > 2 && <Clock className="h-2.5 w-2.5" />}
                      <span className="tabular-nums">
                        {epochsLeft === 1 ? '1 epoch left' : `${epochsLeft} epochs left`}
                      </span>
                    </span>
                  )}
                  {(p.relevantPrefs?.length ?? 0) > 0 &&
                    p.relevantPrefs!.slice(0, 2).map((pref: string) => {
                      const info = PREF_LABELS[pref];
                      if (!info) return null;
                      return (
                        <span
                          key={pref}
                          className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded',
                            info.color,
                          )}
                        >
                          {info.label}
                        </span>
                      );
                    })}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <DiscoverPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  );
}
