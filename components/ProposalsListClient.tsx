'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ProposalWithVoteSummary } from '@/lib/data';
import { useWallet } from '@/utils/wallet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Zap,
  Landmark,
  Eye,
  Scale,
  ArrowUpDown,
  ChevronRight,
  Search,
  Heart,
  UserCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  CircleDashed,
} from 'lucide-react';
import { stripMarkdown } from '@/utils/text';
import { Sparkles, Clock } from 'lucide-react';
import {
  ProposalStatusBadge,
  PriorityBadge,
  DeadlineBadge,
  TreasuryTierBadge,
  TypeExplainerTooltip,
} from '@/components/ProposalStatusBadge';
import { ThresholdMeter } from '@/components/ThresholdMeter';
import { getProposalStatus } from '@/utils/proposalPriority';

interface ProposalsListClientProps {
  proposals: ProposalWithVoteSummary[];
  watchlist?: string[];
  currentEpoch: number;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Landmark; color: string; borderColor: string; iconBg: string }> = {
  TreasuryWithdrawals: { label: 'Treasury', icon: Landmark, color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', borderColor: 'border-l-amber-500', iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  ParameterChange: { label: 'Parameter Change', icon: Shield, color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', borderColor: 'border-l-blue-500', iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  HardForkInitiation: { label: 'Hard Fork', icon: Zap, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30', borderColor: 'border-l-red-500', iconBg: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  InfoAction: { label: 'Info Action', icon: Eye, color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30', borderColor: 'border-l-slate-400', iconBg: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  NoConfidence: { label: 'No Confidence', icon: Scale, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30', borderColor: 'border-l-red-500', iconBg: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  NewCommittee: { label: 'Committee', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30', borderColor: 'border-l-purple-500', iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  NewConstitutionalCommittee: { label: 'Committee', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30', borderColor: 'border-l-purple-500', iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  NewConstitution: { label: 'Constitution', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30', borderColor: 'border-l-purple-500', iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  UpdateConstitution: { label: 'Constitution', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30', borderColor: 'border-l-purple-500', iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
};

type SortKey = 'prominence' | 'date' | 'votes' | 'title';

interface DRepVoteMap {
  [key: string]: 'Yes' | 'No' | 'Abstain';
}

function DRepVoteIndicator({ vote }: { vote: 'Yes' | 'No' | 'Abstain' | null }) {
  if (!vote) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <CircleDashed className="h-3 w-3" />
        Not voted
      </span>
    );
  }

  const config = {
    Yes: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
    No: { icon: XCircle, className: 'text-red-600 dark:text-red-400' },
    Abstain: { icon: MinusCircle, className: 'text-amber-600 dark:text-amber-400' },
  }[vote];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {vote}
    </span>
  );
}

function getProminenceScore(p: ProposalWithVoteSummary, currentEpoch: number): number {
  let score = 0;
  const status = getProposalStatus(p);
  if (status !== 'open') return score;

  const epochsLeft = (p.expirationEpoch ?? 999) - currentEpoch;
  if (epochsLeft <= 2) score += 100;
  else if (epochsLeft <= 5) score += 60;
  else score += 20;

  if (p.proposalType === 'TreasuryWithdrawals') score += 30;
  else if (p.proposalType === 'ParameterChange' || p.proposalType === 'HardForkInitiation') score += 25;

  score += Math.min(p.totalVotes, 50);
  return score;
}

export function ProposalsListClient({ proposals, watchlist = [], currentEpoch }: ProposalsListClientProps) {
  const { delegatedDrepId } = useWallet();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('prominence');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [showMyDrepOnly, setShowMyDrepOnly] = useState(false);
  const [showOpen, setShowOpen] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [drepVotes, setDrepVotes] = useState<DRepVoteMap>({});

  // Fetch delegated DRep's votes client-side for the vote indicator
  useEffect(() => {
    if (!delegatedDrepId) {
      setDrepVotes({});
      return;
    }
    fetch(`/api/drep/${delegatedDrepId}/votes`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.votes) {
          const map: DRepVoteMap = {};
          for (const v of data.votes) {
            map[`${v.proposalTxHash}-${v.proposalIndex}`] = v.vote;
          }
          setDrepVotes(map);
        }
      })
      .catch(() => {});
  }, [delegatedDrepId]);

  const preserveScroll = useCallback((fn: () => void) => {
    const y = window.scrollY;
    fn();
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' })));
  }, []);

  const types = useMemo(() => {
    const set = new Set(proposals.map(p => p.proposalType));
    return [...set].sort();
  }, [proposals]);

  const statusCounts = useMemo(() => {
    let open = 0, closed = 0;
    for (const p of proposals) {
      const s = getProposalStatus(p);
      if (s === 'open') open++;
      else closed++;
    }
    return { open, closed, all: proposals.length };
  }, [proposals]);

  const filtered = useMemo(() => {
    let result = proposals;

    // Status chip filters
    if (showOpen && !showClosed) {
      result = result.filter(p => getProposalStatus(p) === 'open');
    } else if (showClosed && !showOpen) {
      result = result.filter(p => getProposalStatus(p) !== 'open');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.abstract || '').toLowerCase().includes(q) ||
        (p.aiSummary || '').toLowerCase().includes(q) ||
        p.txHash.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter(p => p.proposalType === typeFilter);
    }

    if (showWatchlistOnly && watchlist.length > 0) {
      const wSet = new Set(watchlist);
      result = result.filter(p => p.voterDrepIds.some(id => wSet.has(id)));
    }

    if (showMyDrepOnly && delegatedDrepId) {
      result = result.filter(p => p.voterDrepIds.includes(delegatedDrepId));
    }

    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case 'prominence':
          return getProminenceScore(b, currentEpoch) - getProminenceScore(a, currentEpoch);
        case 'date':
          return (b.blockTime || 0) - (a.blockTime || 0);
        case 'votes':
          return b.totalVotes - a.totalVotes;
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return 0;
      }
    });
    return result;
  }, [proposals, typeFilter, sortKey, searchQuery, showWatchlistOnly, showMyDrepOnly, watchlist, delegatedDrepId, showOpen, showClosed, currentEpoch]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search proposals by title, description, or tx hash..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={showOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => preserveScroll(() => setShowOpen(!showOpen))}
          className="gap-1 text-xs h-7"
        >
          Open ({statusCounts.open})
        </Button>
        <Button
          variant={showClosed ? 'default' : 'outline'}
          size="sm"
          onClick={() => preserveScroll(() => setShowClosed(!showClosed))}
          className="gap-1 text-xs h-7"
        >
          Closed ({statusCounts.closed})
        </Button>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-7 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map(t => (
              <SelectItem key={t} value={t}>
                {TYPE_CONFIG[t]?.label || t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {delegatedDrepId && (
          <Button
            variant={showMyDrepOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => preserveScroll(() => setShowMyDrepOnly(!showMyDrepOnly))}
            className="gap-1 text-xs h-7"
          >
            <UserCheck className="h-3 w-3" />
            My DRep
          </Button>
        )}

        {watchlist.length > 0 && (
          <Button
            variant={showWatchlistOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => preserveScroll(() => setShowWatchlistOnly(!showWatchlistOnly))}
            className="gap-1 text-xs h-7"
          >
            <Heart className="h-3 w-3" />
            Watchlist
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[150px] h-7 text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prominence">Most Relevant</SelectItem>
              <SelectItem value="date">Newest First</SelectItem>
              <SelectItem value="votes">Most Votes</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-3">
        {filtered.map((p) => {
          const config = TYPE_CONFIG[p.proposalType];
          const TypeIcon = config?.icon;
          const date = p.blockTime
            ? new Date(p.blockTime * 1000).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              })
            : null;

          const status = getProposalStatus(p);
          const isOpen = status === 'open';
          const voteKey = `${p.txHash}-${p.proposalIndex}`;
          const drepVote = delegatedDrepId ? (drepVotes[voteKey] || null) : null;
          const epochsLeft = (p.expirationEpoch ?? 999) - currentEpoch;
          const isUrgent = isOpen && epochsLeft <= 2 && epochsLeft > 0;

          return (
            <Link
              key={voteKey}
              href={`/proposals/${p.txHash}/${p.proposalIndex}`}
            >
              <Card className={`hover:bg-muted/30 transition-colors cursor-pointer group mb-3 border-l-4 ${isUrgent ? 'border-l-red-500 bg-gradient-to-r from-red-500/5 to-transparent ring-1 ring-red-500/20' : (config?.borderColor || 'border-l-primary')}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {TypeIcon && (
                      <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 mt-0.5 ${config?.iconBg || 'bg-muted text-muted-foreground'}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ProposalStatusBadge
                          ratifiedEpoch={p.ratifiedEpoch}
                          enactedEpoch={p.enactedEpoch}
                          droppedEpoch={p.droppedEpoch}
                          expiredEpoch={p.expiredEpoch}
                        />
                        {isUrgent && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
                            {epochsLeft <= 1 ? 'Expiring This Epoch' : 'Expiring Soon'}
                          </Badge>
                        )}
                        <PriorityBadge proposalType={p.proposalType} />
                        <TypeExplainerTooltip proposalType={p.proposalType} />
                        {p.treasuryTier && <TreasuryTierBadge tier={p.treasuryTier} />}
                        {isOpen && <DeadlineBadge expirationEpoch={p.expirationEpoch} currentEpoch={currentEpoch} />}
                        {date && <span className="text-[10px] text-muted-foreground">{date}</span>}
                        {delegatedDrepId && (
                          <div className="ml-auto shrink-0">
                            <DRepVoteIndicator vote={drepVote} />
                          </div>
                        )}
                      </div>

                      <p className="font-medium text-sm group-hover:text-primary transition-colors leading-snug">
                        {p.title || `Proposal ${p.txHash.slice(0, 8)}...`}
                      </p>

                      {p.aiSummary ? (
                        <div className="flex items-start gap-1.5">
                          <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {stripMarkdown(p.aiSummary)}
                          </p>
                        </div>
                      ) : p.abstract ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {stripMarkdown(p.abstract)}
                        </p>
                      ) : null}

                      <ThresholdMeter
                        txHash={p.txHash}
                        proposalIndex={p.proposalIndex}
                        proposalType={p.proposalType}
                        yesCount={p.yesCount}
                        noCount={p.noCount}
                        abstainCount={p.abstainCount}
                        totalVotes={p.totalVotes}
                        isOpen={isOpen}
                        variant="compact"
                      />
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && proposals.length === 0 && (
        <EmptyState
          icon={Clock}
          title="Proposals syncing"
          message="Proposal data hasn't been synced yet. This usually resolves within a few minutes — check back shortly."
          compact
          component="proposals_list"
        />
      )}
      {filtered.length === 0 && proposals.length > 0 && (
        <EmptyState
          icon="search"
          title="The pipeline is quiet"
          message="No proposals match your filters. The governance pipeline has quiet moments — try broadening your search or check back soon."
          action={{ label: 'Clear Filters', onClick: () => { setTypeFilter('all'); setSearchQuery(''); } }}
          compact
          component="proposals_list"
        />
      )}
    </div>
  );
}
