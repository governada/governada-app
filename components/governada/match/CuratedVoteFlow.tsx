'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  History,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Vote,
  Minus,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getStoredSession } from '@/lib/supabaseAuth';
import { useWallet } from '@/utils/wallet-context';
import { ConfidenceBar } from '@/components/matching/ConfidenceBar';
import {
  calculateProgressiveConfidence,
  type ConfidenceBreakdown,
} from '@/lib/matching/confidence';
import { usePostHog } from 'posthog-js/react';
import { getProposalTheme } from '@/components/governada/proposals/proposal-theme';

/* ─── Types ────────────────────────────────────────────── */

interface DimensionScores {
  treasuryConservative: number;
  treasuryGrowth: number;
  decentralization: number;
  security: number;
  innovation: number;
  transparency: number;
}

interface CuratedProposal {
  txHash: string;
  index: number;
  title: string | null;
  summary: string | null;
  type: string | null;
  status: string;
  expirationEpoch: number | null;
  withdrawalAmount: number | null;
  relevantPrefs: string[];
  community: { yes: number; no: number; abstain: number; total: number } | null;
  isHistorical: boolean;
  dimensions: DimensionScores | null;
  drepVote: string | null;
}

interface CuratedProposalsResponse {
  proposals: CuratedProposal[];
  currentEpoch: number | null;
  votedTypes: string[];
  totalVoted: number;
}

type VoteChoice = 'yes' | 'no' | 'abstain';

interface VoteResult {
  community: { yes: number; no: number; abstain: number; total: number };
  userVote: string;
}

/* ─── Constants ────────────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  InfoAction: '#3b82f6',
  TreasuryWithdrawals: '#f59e0b',
  ParameterChange: '#8b5cf6',
  HardForkInitiation: '#ef4444',
  NewConstitution: '#10b981',
  NoConfidence: '#f43f5e',
  UpdateCommittee: '#06b6d4',
};

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_COLORS: Record<keyof DimensionScores, string> = {
  treasuryConservative: '#f59e0b',
  treasuryGrowth: '#22c55e',
  decentralization: '#a855f7',
  security: '#ef4444',
  innovation: '#06b6d4',
  transparency: '#3b82f6',
};

/* ─── Helpers ──────────────────────────────────────────── */

function getTopDimensions(
  dims: DimensionScores,
  threshold = 0.4,
): { key: keyof DimensionScores; score: number; label: string }[] {
  return (Object.entries(dims) as [keyof DimensionScores, number][])
    .filter(([, score]) => score >= threshold)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key, score]) => ({ key, score, label: DIMENSION_LABELS[key] }));
}

function formatDrepVote(vote: string): { label: string; color: string } {
  switch (vote.toLowerCase()) {
    case 'yes':
      return { label: 'Yes', color: 'text-green-500' };
    case 'no':
      return { label: 'No', color: 'text-red-500' };
    case 'abstain':
      return { label: 'Abstain', color: 'text-muted-foreground' };
    default:
      return { label: vote, color: 'text-muted-foreground' };
  }
}

/* ─── Component ────────────────────────────────────────── */

export function CuratedVoteFlow() {
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const { delegatedDrepId } = useWallet();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [votedMap, setVotedMap] = useState<Map<string, VoteResult>>(new Map());
  const [voting, setVoting] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [sessionVoteCount, setSessionVoteCount] = useState(0);
  const [sessionTypesVoted, setSessionTypesVoted] = useState<Set<string>>(new Set());
  const [showComplete, setShowComplete] = useState(false);

  const token = useMemo(() => getStoredSession(), []);
  const isAuthenticated = !!token;

  // Fetch curated proposals (include drepId for DRep vote comparison)
  const { data, isLoading, error } = useQuery<CuratedProposalsResponse>({
    queryKey: ['curated-proposals', delegatedDrepId],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const params = new URLSearchParams();
      if (delegatedDrepId) params.set('drepId', delegatedDrepId);
      const qs = params.toString();
      const res = await fetch(`/api/match/proposals${qs ? `?${qs}` : ''}`, { headers });
      if (!res.ok) throw new Error('Failed to load proposals');
      return res.json();
    },
    staleTime: 120_000,
  });

  const proposals = useMemo(() => data?.proposals ?? [], [data?.proposals]);
  const currentProposal = proposals[currentIndex] ?? null;

  // Compute running confidence
  const confidence: ConfidenceBreakdown = useMemo(() => {
    const baseVotes = data?.totalVoted ?? 0;
    const baseTypes = data?.votedTypes?.length ?? 0;
    return calculateProgressiveConfidence({
      quizAnswerCount: 3,
      pollVoteCount: baseVotes + sessionVoteCount,
      proposalTypesVoted: baseTypes + sessionTypesVoted.size,
      engagementActionCount: 0,
      hasDelegation: !!delegatedDrepId,
    });
  }, [data, sessionVoteCount, sessionTypesVoted, delegatedDrepId]);

  // Submit vote
  const submitVote = useCallback(
    async (vote: VoteChoice) => {
      if (!currentProposal || !token) return;
      setVoting(true);

      try {
        const res = await fetch('/api/polls/vote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            proposalTxHash: currentProposal.txHash,
            proposalIndex: currentProposal.index,
            vote,
          }),
        });

        if (!res.ok) throw new Error('Vote failed');
        const result: VoteResult = await res.json();

        const key = `${currentProposal.txHash}-${currentProposal.index}`;
        setVotedMap((prev) => new Map(prev).set(key, result));
        setSessionVoteCount((c) => c + 1);
        if (currentProposal.type) {
          setSessionTypesVoted((prev) => new Set(prev).add(currentProposal.type!));
        }
        setShowReveal(true);

        posthog?.capture('curated_vote_submitted', {
          proposal_tx_hash: currentProposal.txHash,
          proposal_type: currentProposal.type,
          vote,
          is_historical: currentProposal.isHistorical,
          session_vote_number: sessionVoteCount + 1,
          agreed_with_drep: currentProposal.drepVote
            ? vote === currentProposal.drepVote.toLowerCase()
            : null,
        });
      } catch {
        // Could show toast, but keep simple for MVP
      } finally {
        setVoting(false);
      }
    },
    [currentProposal, token, sessionVoteCount, posthog],
  );

  // Advance to next card
  const advanceToNext = useCallback(() => {
    setShowReveal(false);
    if (currentIndex + 1 < proposals.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setShowComplete(true);
    }
  }, [currentIndex, proposals.length]);

  // Skip (no vote recorded)
  const skip = useCallback(() => {
    setShowReveal(false);
    if (currentIndex + 1 < proposals.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setShowComplete(true);
    }
  }, [currentIndex, proposals.length]);

  // Restart session
  const restart = useCallback(() => {
    setCurrentIndex(0);
    setVotedMap(new Map());
    setShowReveal(false);
    setSessionVoteCount(0);
    setSessionTypesVoted(new Set());
    setShowComplete(false);
    queryClient.invalidateQueries({ queryKey: ['curated-proposals'] });
  }, [queryClient]);

  // Count DRep agreements for session summary
  const drepAgreements = useMemo(() => {
    let agreed = 0;
    let disagreed = 0;
    let total = 0;
    for (const [key, result] of votedMap) {
      const proposal = proposals.find((p) => `${p.txHash}-${p.index}` === key);
      if (proposal?.drepVote) {
        total++;
        if (result.userVote === proposal.drepVote.toLowerCase()) {
          agreed++;
        } else {
          disagreed++;
        }
      }
    }
    return { agreed, disagreed, total };
  }, [votedMap, proposals]);

  /* ─── Loading / Error / Empty states ──────────────────── */

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center space-y-3 animate-pulse">
          <Vote className="h-10 w-10 mx-auto text-primary/50" />
          <p className="text-sm text-muted-foreground">Loading proposals...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="font-medium">Could not load proposals</p>
          <p className="text-sm text-muted-foreground">Please try again later.</p>
          <Button asChild variant="outline">
            <Link href="/match">Back to Match</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-500" />
          </div>
          <p className="font-semibold">You&apos;re all caught up!</p>
          <p className="text-sm text-muted-foreground">
            You&apos;ve voted on all available proposals. New proposals will appear as they&apos;re
            submitted to governance.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild>
              <Link href="/match">View Match Results</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/governance/proposals">Browse All Proposals</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Session complete ────────────────────────────────── */

  if (showComplete) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold">Session Complete</h2>
            <p className="text-sm text-muted-foreground">
              You voted on {sessionVoteCount} proposal{sessionVoteCount !== 1 ? 's' : ''} across{' '}
              {sessionTypesVoted.size} type{sessionTypesVoted.size !== 1 ? 's' : ''}.
            </p>
          </div>

          {/* DRep alignment summary */}
          {drepAgreements.total > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary/70" />
                  <h4 className="text-sm font-semibold">DRep Alignment</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  You agreed with your DRep on{' '}
                  <span className="font-semibold text-foreground">
                    {drepAgreements.agreed} of {drepAgreements.total}
                  </span>{' '}
                  proposal{drepAgreements.total !== 1 ? 's' : ''} they voted on.
                </p>
                {drepAgreements.total >= 3 && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.round((drepAgreements.agreed / drepAgreements.total) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">Match Confidence</h4>
              <ConfidenceBar
                confidence={confidence.overall}
                sources={confidence.sources}
                expandable
              />
              {confidence.overall < 70 && (
                <p className="text-xs text-muted-foreground">
                  Keep voting to strengthen your governance profile and improve match accuracy.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={restart} variant="outline">
              Vote on More
            </Button>
            <Button asChild>
              <Link href="/match">
                View Updated Matches
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Main voting flow ────────────────────────────────── */

  const key = currentProposal ? `${currentProposal.txHash}-${currentProposal.index}` : '';
  const voteResult = votedMap.get(key);
  const typeColor = currentProposal?.type
    ? (TYPE_COLORS[currentProposal.type] ?? '#6b7280')
    : '#6b7280';
  const typeLabel = currentProposal?.type
    ? (getProposalTheme(currentProposal.type).label ?? currentProposal.type)
    : 'Proposal';
  const epochsLeft =
    currentProposal?.expirationEpoch && data.currentEpoch
      ? currentProposal.expirationEpoch - data.currentEpoch
      : null;

  // Top dimensions for "why this matters"
  const topDimensions = currentProposal?.dimensions
    ? getTopDimensions(currentProposal.dimensions)
    : [];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top bar: progress + confidence */}
      <div className="sticky top-14 z-10 bg-background/80 backdrop-blur-sm border-b border-border/30">
        <div className="mx-auto max-w-2xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Link
              href="/match"
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Match
            </Link>
            <span className="text-muted-foreground tabular-nums">
              {currentIndex + 1} / {proposals.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {proposals.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  i < currentIndex
                    ? 'bg-primary'
                    : i === currentIndex
                      ? 'bg-primary/50'
                      : 'bg-muted',
                )}
              />
            ))}
          </div>
          <ConfidenceBar confidence={confidence.overall} sources={confidence.sources} />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        {currentProposal && (
          <div
            key={key}
            className="w-full max-w-xl animate-in fade-in slide-in-from-right-6 duration-300"
          >
            <Card className="overflow-hidden">
              <CardContent className="p-5 sm:p-6 space-y-4">
                {/* Type badge + status */}
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="text-xs font-medium"
                    style={{
                      color: typeColor,
                      borderColor: typeColor + '40',
                      backgroundColor: typeColor + '10',
                    }}
                  >
                    {typeLabel}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {currentProposal.isHistorical && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <History className="h-3 w-3" />
                        Historical
                      </Badge>
                    )}
                    {!currentProposal.isHistorical && epochsLeft != null && epochsLeft > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" />
                        {epochsLeft} epoch{epochsLeft !== 1 ? 's' : ''} left
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-display text-lg sm:text-xl font-bold leading-tight">
                  {currentProposal.title || 'Untitled Proposal'}
                </h3>

                {/* AI Summary */}
                {currentProposal.summary && (
                  <div className="rounded-lg bg-muted/50 p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary/60" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        AI Summary
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {currentProposal.summary}
                    </p>
                  </div>
                )}

                {/* Why this matters — governance dimensions */}
                {topDimensions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topDimensions.map((dim) => (
                      <span
                        key={dim.key}
                        className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-medium"
                        style={{
                          color: DIMENSION_COLORS[dim.key],
                          backgroundColor: DIMENSION_COLORS[dim.key] + '12',
                          borderColor: DIMENSION_COLORS[dim.key] + '30',
                          borderWidth: '1px',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: DIMENSION_COLORS[dim.key] }}
                        />
                        {dim.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Treasury amount */}
                {currentProposal.withdrawalAmount != null &&
                  currentProposal.withdrawalAmount > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Requesting{' '}
                      <span className="font-semibold text-foreground">
                        {(currentProposal.withdrawalAmount / 1_000_000).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}{' '}
                        ADA
                      </span>{' '}
                      from the treasury
                    </div>
                  )}

                {/* DRep vote indicator (pre-vote, subtle hint) */}
                {currentProposal.drepVote && !showReveal && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                    <Users className="h-3 w-3" />
                    <span>Your DRep has voted on this proposal</span>
                  </div>
                )}

                {/* Vote reveal state */}
                {showReveal && voteResult ? (
                  <VoteReveal
                    result={voteResult}
                    proposal={currentProposal}
                    onContinue={advanceToNext}
                    isLast={currentIndex + 1 >= proposals.length}
                  />
                ) : (
                  /* Vote buttons */
                  <div className="space-y-3 pt-2">
                    {!isAuthenticated ? (
                      <div className="text-center space-y-2 py-4">
                        <p className="text-sm text-muted-foreground">
                          Connect your wallet to vote on proposals and build your governance
                          profile.
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          You can browse proposals without a wallet, but voting requires
                          authentication.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          onClick={() => submitVote('yes')}
                          disabled={voting}
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                          size="lg"
                        >
                          <ThumbsUp className="h-4 w-4" />
                          Yes
                        </Button>
                        <Button
                          onClick={() => submitVote('no')}
                          disabled={voting}
                          className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                          size="lg"
                        >
                          <ThumbsDown className="h-4 w-4" />
                          No
                        </Button>
                        <Button
                          onClick={() => submitVote('abstain')}
                          disabled={voting}
                          variant="secondary"
                          className="gap-1.5"
                          size="lg"
                        >
                          <Minus className="h-4 w-4" />
                          Abstain
                        </Button>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <button
                        onClick={skip}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 py-1"
                      >
                        <SkipForward className="h-3 w-3" />
                        Skip this proposal
                      </button>
                    </div>

                    {/* Link to full detail */}
                    <div className="flex justify-center pt-1">
                      <Link
                        href={`/proposal/${encodeURIComponent(currentProposal.txHash)}/${currentProposal.index}`}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                      >
                        View full proposal details
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Vote Reveal ──────────────────────────────────────── */

function VoteReveal({
  result,
  proposal,
  onContinue,
  isLast,
}: {
  result: VoteResult;
  proposal: CuratedProposal;
  onContinue: () => void;
  isLast: boolean;
}) {
  const total = result.community.total;
  const yesPct = total > 0 ? Math.round((result.community.yes / total) * 100) : 0;
  const noPct = total > 0 ? Math.round((result.community.no / total) * 100) : 0;
  const abstainPct = total > 0 ? Math.round((result.community.abstain / total) * 100) : 0;

  const voteLabel = result.userVote === 'yes' ? 'Yes' : result.userVote === 'no' ? 'No' : 'Abstain';
  const voteColor =
    result.userVote === 'yes'
      ? 'text-green-500'
      : result.userVote === 'no'
        ? 'text-red-500'
        : 'text-muted-foreground';

  // DRep vote comparison
  const drepVote = proposal.drepVote ? formatDrepVote(proposal.drepVote) : null;
  const agreedWithDrep = proposal.drepVote
    ? result.userVote === proposal.drepVote.toLowerCase()
    : null;

  return (
    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* User's vote */}
      <div className="flex items-center justify-center gap-2">
        <Check className={cn('h-4 w-4', voteColor)} />
        <span className={cn('text-sm font-medium', voteColor)}>You voted {voteLabel}</span>
      </div>

      {/* DRep vote comparison */}
      {drepVote && (
        <div
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-sm',
            agreedWithDrep
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          <Users className="h-3.5 w-3.5" />
          <span>
            Your DRep voted{' '}
            <span className={cn('font-semibold', drepVote.color)}>{drepVote.label}</span>
            {agreedWithDrep != null && (
              <span className="ml-1.5 text-xs opacity-80">
                {agreedWithDrep ? '— you agree' : '— you differ'}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Community consensus */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground text-center font-medium">
          Community ({total} vote{total !== 1 ? 's' : ''})
        </p>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
          {yesPct > 0 && (
            <div
              className="bg-green-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${yesPct}%` }}
            />
          )}
          {noPct > 0 && (
            <div
              className="bg-red-500 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${noPct}%` }}
            />
          )}
          {abstainPct > 0 && (
            <div
              className="bg-gray-400 transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${abstainPct}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
            Yes {yesPct}%
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
            No {noPct}%
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1" />
            Abstain {abstainPct}%
          </span>
        </div>
      </div>

      {/* Historical outcome */}
      {proposal.isHistorical && (
        <div className="text-center">
          <Badge variant="secondary" className="text-xs">
            This proposal was {proposal.status.toLowerCase()}
          </Badge>
        </div>
      )}

      {/* Continue button */}
      <Button onClick={onContinue} className="w-full gap-2" size="lg">
        {isLast ? (
          <>
            <Trophy className="h-4 w-4" />
            View Session Summary
          </>
        ) : (
          <>
            Next Proposal
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
