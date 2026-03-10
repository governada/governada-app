'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HexScore } from '@/components/HexScore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TYPE_EXPLAINERS } from '@/utils/proposalPriority';
import {
  Shield,
  Vote,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Users,
  Repeat,
  BarChart3,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ScrollText,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export interface DelegationHealth {
  drepId: string;
  drepName: string | null;
  drepScore: number;
  participationRate: number;
  votedOnOpen: number;
  openProposalCount: number;
  representationScore: number | null;
}

export interface RepresentationData {
  score: number | null;
  aligned: number;
  misaligned: number;
  total: number;
  comparisons: {
    proposalTxHash: string;
    proposalIndex: number;
    proposalTitle: string | null;
    userVote: string;
    drepVote: string;
    aligned: boolean;
  }[];
}

export interface ActiveProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  proposalType: string;
  priority: string;
  epochsRemaining: number | null;
  userVote: string | null;
  drepVote: string | null;
}

export interface RedelegationSuggestion {
  drepId: string;
  drepName: string | null;
  drepScore: number;
  matchCount: number;
  totalComparisons: number;
  matchRate: number;
}

export interface DashboardData {
  delegationHealth: DelegationHealth | null;
  representationScore: RepresentationData;
  activeProposals: ActiveProposal[];
  pollHistory: {
    proposalTxHash: string;
    proposalIndex: number;
    proposalTitle: string | null;
    proposalType: string | null;
    withdrawalAmount: number | null;
    userVote: string;
    communityConsensus: string | null;
    drepVote: string | null;
    alignedWithDrep: boolean | null;
    votedAt: string;
  }[];
  redelegationSuggestions: RedelegationSuggestion[];
  currentEpoch: number;
  repScoreDelta: number | null;
}

const VOTE_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  Yes: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  No: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  Abstain: {
    icon: MinusCircle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
};

const PRIORITY_STYLES: Record<string, { className: string; tooltip: string }> = {
  critical: {
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    tooltip:
      'Critical: Fundamentally changes the network or governance structure. Requires careful attention.',
  },
  important: {
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    tooltip: 'Important: Changes protocol parameters that affect fees, rewards, or block sizes.',
  },
};

const TYPE_LABELS: Record<string, string> = {
  TreasuryWithdrawals: 'Treasury',
  ParameterChange: 'Params',
  HardForkInitiation: 'Hard Fork',
  NoConfidence: 'No Confidence',
  NewCommittee: 'Committee',
  NewConstitutionalCommittee: 'Committee',
  NewConstitution: 'Constitution',
  UpdateConstitution: 'Constitution',
  InfoAction: 'Info',
};

export function VoteBadge({ vote, label }: { vote: string; label?: string }) {
  const config = VOTE_CONFIG[vote];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded shrink-0 ${config.bg} ${config.color}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label ? `${label}: ${vote}` : vote}
    </span>
  );
}

function DeadlineBadge({ epochsRemaining }: { epochsRemaining: number | null }) {
  if (epochsRemaining === null) return null;

  const days = epochsRemaining * 5;
  let style: string;
  let label: string;

  if (epochsRemaining <= 0) {
    style =
      'text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
    label = 'Expiring';
  } else if (epochsRemaining <= 2) {
    style = 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-800';
    label = `~${days}d left`;
  } else if (epochsRemaining <= 4) {
    style = 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800';
    label = `~${days}d left`;
  } else {
    style = 'text-muted-foreground border-border';
    label = `~${days}d left`;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`text-[10px] shrink-0 gap-0.5 cursor-help ${style}`}>
          <Clock className="h-2.5 w-2.5" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <p className="text-xs">
          {epochsRemaining <= 0
            ? 'This proposal is expiring this epoch.'
            : `Expires in ~${epochsRemaining} epoch${epochsRemaining !== 1 ? 's' : ''} (~${days} days)`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function DelegationHealthCard({
  health,
  scoreDelta,
}: {
  health: DelegationHealth | null;
  scoreDelta?: number | null;
}) {
  if (!health) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Delegation Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t delegated to a DRep yet. Find one aligned with your values to
            participate in governance.
          </p>
          <Link href="/governance/representatives">
            <Button size="sm" className="gap-2">
              Find a DRep
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const votePct =
    health.openProposalCount > 0
      ? Math.round((health.votedOnOpen / health.openProposalCount) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Your DRep
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/drep/${encodeURIComponent(health.drepId)}`}
              className="text-lg font-semibold hover:text-primary transition-colors"
            >
              {health.drepName || health.drepId.slice(0, 16) + '...'}
            </Link>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              Score: {health.drepScore}/100
              {scoreDelta != null && scoreDelta !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${scoreDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {scoreDelta > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {scoreDelta > 0 ? '+' : ''}
                  {scoreDelta}
                </span>
              )}
            </p>
          </div>
          <Link href={`/drep/${encodeURIComponent(health.drepId)}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs hover:text-primary hover:bg-primary/10"
            >
              Profile <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Voted on open proposals</span>
            <span className="font-medium tabular-nums">
              {health.votedOnOpen}/{health.openProposalCount}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                votePct >= 80 ? 'bg-green-500' : votePct >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${votePct}%` }}
            />
          </div>
        </div>

        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Participation</span>
            <p className="font-semibold tabular-nums">{health.participationRate}%</p>
          </div>
          {health.representationScore !== null && (
            <div>
              <span className="text-muted-foreground">Representation</span>
              <p className="font-semibold tabular-nums">{health.representationScore}%</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RepresentationScoreCard({ rep }: { rep: RepresentationData }) {
  const [showAll, setShowAll] = useState(false);
  const visibleComparisons = showAll ? rep.comparisons : rep.comparisons.slice(0, 5);

  if (rep.score === null || rep.total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Representation Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vote on proposals to see how well your DRep represents your views. Each poll vote you
            cast builds this score.
          </p>
          <Link href="/governance/proposals">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hover:text-primary hover:bg-primary/10"
            >
              <Vote className="h-3.5 w-3.5" />
              Vote on Proposals
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Representation Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-6">
          <HexScore
            score={rep.score}
            alignments={{
              treasuryConservative: null,
              treasuryGrowth: null,
              decentralization: null,
              security: null,
              innovation: null,
              transparency: null,
            }}
            size="card"
          />
          <div className="space-y-1">
            <p className="text-sm">
              Your DRep voted with you <strong>{rep.aligned}</strong> of{' '}
              <strong>{rep.total}</strong> times.
            </p>
            <p className="text-xs text-muted-foreground">
              Based on proposals where you both weighed in.
            </p>
          </div>
        </div>

        {visibleComparisons.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vote Comparison
            </p>
            {visibleComparisons.map((c) => (
              <Link
                key={`${c.proposalTxHash}-${c.proposalIndex}`}
                href={`/proposals/${c.proposalTxHash}/${c.proposalIndex}`}
                className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
              >
                {c.aligned ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className="truncate flex-1">
                  {c.proposalTitle || `${c.proposalTxHash.slice(0, 12)}...`}
                </span>
                <VoteBadge vote={c.userVote} label="You" />
                <VoteBadge vote={c.drepVote} label="DRep" />
              </Link>
            ))}
            {rep.comparisons.length > 5 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-primary hover:underline"
              >
                {showAll ? 'Show less' : `Show all ${rep.comparisons.length} comparisons`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ActiveProposalsSection({ proposals }: { proposals: ActiveProposal[] }) {
  const needsVoteCount = useMemo(() => proposals.filter((p) => !p.userVote).length, [proposals]);

  if (proposals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Vote className="h-4 w-4 text-primary" />
            Active Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ScrollText}
            title="All Quiet on the Governance Front"
            message="No proposals are open right now. Check back next epoch, or review recent outcomes."
            action={{ label: 'View Past Proposals', href: '/governance/proposals' }}
            compact
            component="ActiveProposals"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Vote className="h-4 w-4 text-primary" />
            Active Proposals
          </CardTitle>
          {needsVoteCount > 0 && (
            <Badge
              variant="outline"
              className="text-xs gap-1 bg-primary/10 text-primary border-primary/30"
            >
              {needsVoteCount} need your vote
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={300}>
          <div className="space-y-1">
            {proposals.map((p) => {
              const typeLabel = TYPE_LABELS[p.proposalType] || p.proposalType;
              const typeExplainer = TYPE_EXPLAINERS[p.proposalType];
              const priority = PRIORITY_STYLES[p.priority];

              return (
                <Link
                  key={`${p.txHash}-${p.proposalIndex}`}
                  href={`/proposals/${p.txHash}/${p.proposalIndex}`}
                  className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded px-2 py-2 -mx-2 transition-colors"
                >
                  {p.userVote ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}

                  <span className="truncate flex-1">
                    {p.title || `Proposal ${p.txHash.slice(0, 12)}...`}
                  </span>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 cursor-help bg-muted/50 text-muted-foreground border-border"
                      >
                        {typeLabel}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px]">
                      <p className="text-xs">{typeExplainer || p.proposalType}</p>
                    </TooltipContent>
                  </Tooltip>

                  {priority && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 cursor-help ${priority.className}`}
                        >
                          {p.priority === 'critical' ? 'Critical' : 'Important'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        <p className="text-xs">{priority.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <DeadlineBadge epochsRemaining={p.epochsRemaining} />

                  {p.userVote && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <VoteBadge vote={p.userVote} label="You" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Your poll vote on this proposal</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {p.drepVote && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <VoteBadge vote={p.drepVote} label="DRep" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Your DRep&apos;s on-chain governance vote</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </div>
        </TooltipProvider>

        <div className="mt-3 pt-3 border-t">
          <Link href="/governance/proposals">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1 hover:text-primary hover:bg-primary/10"
            >
              View All Proposals
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function RedelegationNudge({
  repScore,
  misaligned,
  total,
  suggestions,
}: {
  repScore: number;
  misaligned: number;
  total: number;
  suggestions: RedelegationSuggestion[];
}) {
  return (
    <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <Repeat className="h-4 w-4" />
          Representation Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
          Your DRep voted differently from you on <strong>{misaligned}</strong> of{' '}
          <strong>{total}</strong> recent proposals ({repScore}% alignment). Consider exploring
          DReps who vote more like you.
        </p>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-800/70 dark:text-amber-300/70 uppercase tracking-wide">
              DReps who voted like you
            </p>
            {suggestions.map((s) => (
              <Link
                key={s.drepId}
                href={`/drep/${encodeURIComponent(s.drepId)}`}
                className="flex items-center gap-3 text-sm hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded px-2 py-1.5 -mx-2 transition-colors"
              >
                <Users className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span className="truncate flex-1 font-medium">
                  {s.drepName || `${s.drepId.slice(0, 16)}...`}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Score: {s.drepScore}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-800"
                >
                  {s.matchRate}% match
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
