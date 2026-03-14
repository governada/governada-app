'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { resolveRewardAddress } from '@meshsdk/core';
import { hapticLight } from '@/lib/haptics';
import { useSentimentResults, type SentimentResults } from '@/hooks/useEngagement';
import { useConcernFlags } from '@/hooks/useEngagement';
import { CONCERN_FLAG_LABELS } from '@/lib/engagement/labels';
import { AskYourDRep } from '@/components/engagement/AskYourDRep';
import type { ConcernFlagType } from '@/lib/api/schemas/engagement';

type SentimentChoice = 'support' | 'oppose' | 'unsure';

interface CitizenEngagementSectionProps {
  txHash: string;
  proposalIndex: number;
  proposalTitle: string;
  isOpen: boolean;
}

/**
 * Unified citizen engagement section.
 * Combines sentiment voting, concern flags, and Ask Your DRep
 * into a single coherent card with clear context.
 */
export function CitizenEngagementSection({
  txHash,
  proposalIndex,
  proposalTitle,
  isOpen,
}: CitizenEngagementSectionProps) {
  const { connected, isAuthenticated, address, delegatedDrepId, ownDRepId, authenticate } =
    useWallet();
  const queryClient = useQueryClient();

  const {
    data: sentimentResults,
    isLoading: sentimentLoading,
    isError: sentimentError,
    refetch: refetchSentiment,
  } = useSentimentResults(txHash, proposalIndex, ownDRepId);

  const {
    data: concernResults,
    isLoading: concernsLoading,
    refetch: refetchConcerns,
  } = useConcernFlags(txHash, proposalIndex);

  const [voting, setVoting] = useState(false);
  const [changingVote, setChangingVote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concernsExpanded, setConcernsExpanded] = useState(false);
  const [submittingFlag, setSubmittingFlag] = useState<string | null>(null);

  const hasVoted = sentimentResults?.hasVoted ?? false;
  const userSentiment = sentimentResults?.userSentiment ?? null;
  const sentimentQueryKey = ['citizen-sentiment', txHash, proposalIndex, ownDRepId ?? null];
  const concernQueryKey = ['concern-flags', txHash, proposalIndex];

  const castVote = async (sentiment: SentimentChoice) => {
    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    setVoting(true);
    setError(null);

    const previousData = queryClient.getQueryData<SentimentResults>(sentimentQueryKey);
    queryClient.setQueryData<SentimentResults>(sentimentQueryKey, (old) => {
      if (!old) return old;
      const prev = old.userSentiment;
      const community = { ...old.community };
      if (prev) {
        community[prev] = Math.max(0, community[prev] - 1);
        community.total = Math.max(0, community.total - 1);
      }
      community[sentiment] = (community[sentiment] ?? 0) + 1;
      if (!prev) community.total += 1;
      else community.total += 1;
      return { ...old, community, userSentiment: sentiment, hasVoted: true };
    });
    setChangingVote(false);

    try {
      const token = getStoredSession();
      if (!token) throw new Error('Not authenticated');

      let stakeAddress: string | undefined;
      if (address) {
        try {
          stakeAddress = resolveRewardAddress(address);
        } catch {
          /* script addresses won't resolve */
        }
      }

      const res = await fetch('/api/engagement/sentiment/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposalTxHash: txHash,
          proposalIndex,
          sentiment,
          stakeAddress,
          delegatedDrepId,
        }),
      });

      if (res.status === 429) {
        throw new Error(
          "You've been active! You've reached the vote limit for this epoch — resets next epoch.",
        );
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Vote failed');
      }

      await refetchSentiment();

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_sentiment_voted', {
            proposal_tx_hash: txHash,
            proposal_index: proposalIndex,
            sentiment,
          });
        })
        .catch(() => {});
    } catch (err) {
      if (previousData) queryClient.setQueryData(sentimentQueryKey, previousData);
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  const toggleFlag = async (flagType: ConcernFlagType) => {
    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    const token = getStoredSession();
    if (!token) return;

    const isRemoving = concernResults?.userFlags.includes(flagType);
    setSubmittingFlag(flagType);
    setError(null);

    const previousData = queryClient.getQueryData(concernQueryKey);
    queryClient.setQueryData(concernQueryKey, (old: typeof concernResults) => {
      if (!old) return old;
      const flags = { ...old.flags };
      const userFlags = [...old.userFlags];
      let total = old.total;
      if (isRemoving) {
        flags[flagType] = Math.max(0, (flags[flagType] || 0) - 1);
        total = Math.max(0, total - 1);
        const idx = userFlags.indexOf(flagType);
        if (idx >= 0) userFlags.splice(idx, 1);
      } else {
        flags[flagType] = (flags[flagType] || 0) + 1;
        total += 1;
        userFlags.push(flagType);
      }
      return { ...old, flags, userFlags, total };
    });

    try {
      const res = await fetch('/api/engagement/concerns', {
        method: isRemoving ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposalTxHash: txHash,
          proposalIndex,
          flagType,
        }),
      });

      if (res.status === 429) {
        throw new Error(
          "You've been active! You've reached the flag limit for this epoch — resets next epoch.",
        );
      }
      if (!res.ok && res.status !== 409) {
        throw new Error('Failed to update flag');
      }

      await refetchConcerns();

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture(isRemoving ? 'citizen_concern_removed' : 'citizen_concern_flagged', {
            proposal_tx_hash: txHash,
            proposal_index: proposalIndex,
            flag_type: flagType,
          });
        })
        .catch(() => {});
    } catch (err) {
      if (previousData) queryClient.setQueryData(concernQueryKey, previousData);
      setError(err instanceof Error ? err.message : 'Failed to update flag');
    } finally {
      setSubmittingFlag(null);
    }
  };

  if (sentimentLoading) {
    return (
      <Card className="ring-1 ring-primary/10">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 flex-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sentimentError) {
    return (
      <Card className="ring-1 ring-primary/10">
        <CardContent className="py-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load engagement data</p>
          <Button variant="outline" size="sm" onClick={() => refetchSentiment()}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const community = sentimentResults?.community ?? { support: 0, oppose: 0, unsure: 0, total: 0 };

  // Compact summary for closed proposals where user hasn't voted
  if (!isOpen && !hasVoted) {
    if (community.total === 0) return null;
    const topSentiment =
      community.support >= community.oppose && community.support >= community.unsure
        ? 'Support'
        : community.oppose >= community.unsure
          ? 'Oppose'
          : 'Unsure';
    const topPct = Math.round(
      ((topSentiment === 'Support'
        ? community.support
        : topSentiment === 'Oppose'
          ? community.oppose
          : community.unsure) /
        community.total) *
        100,
    );
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
        <BarChart3 className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>
          {community.total} citizen{community.total !== 1 ? 's' : ''} shared their opinion —{' '}
          {topPct}% {topSentiment}
        </span>
      </div>
    );
  }

  const showButtons = isOpen && (!hasVoted || changingVote) && connected;

  const flags = concernResults?.flags ?? {};
  const userFlags = concernResults?.userFlags ?? [];
  const totalFlags = concernResults?.total ?? 0;

  const sortedFlags = (Object.keys(CONCERN_FLAG_LABELS) as ConcernFlagType[]).sort((a, b) => {
    const aUser = userFlags.includes(a) ? 1 : 0;
    const bUser = userFlags.includes(b) ? 1 : 0;
    if (aUser !== bUser) return bUser - aUser;
    return (flags[b] || 0) - (flags[a] || 0);
  });

  const labelMap: Record<SentimentChoice, string> = {
    support: 'Support',
    oppose: 'Oppose',
    unsure: 'Unsure',
  };

  return (
    <div className="space-y-4">
      <Card className="ring-1 ring-primary/10" aria-label="Your voice on this proposal">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
            Your Voice on This Proposal
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Your opinion helps DReps understand what citizens want.
            {community.total > 0 && (
              <span className="font-medium">
                {' '}
                {community.total} citizen{community.total !== 1 ? 's' : ''} have shared theirs.
              </span>
            )}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current results */}
          {community.total > 0 && (
            <div className="space-y-2">
              <SentimentBar
                label="Support"
                count={community.support}
                total={community.total}
                color="bg-green-500"
              />
              <SentimentBar
                label="Oppose"
                count={community.oppose}
                total={community.total}
                color="bg-red-500"
              />
              <SentimentBar
                label="Unsure"
                count={community.unsure}
                total={community.total}
                color="bg-amber-500"
              />
            </div>
          )}

          {/* User's current vote */}
          {hasVoted && !changingVote && userSentiment && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>
                You voted <strong>{labelMap[userSentiment]}</strong>.
              </span>
              {isOpen && (
                <button
                  onClick={() => setChangingVote(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-auto"
                >
                  Change
                </button>
              )}
            </div>
          )}

          {/* Voting buttons */}
          {showButtons && (
            <SentimentButtons
              onVote={castVote}
              voting={voting}
              currentVote={changingVote ? userSentiment : null}
            />
          )}

          {/* Prompt for unvoted connected users */}
          {isOpen && !hasVoted && connected && !showButtons && community.total === 0 && (
            <p className="text-sm text-muted-foreground">
              Be the first to share your opinion on this proposal.
            </p>
          )}

          {/* Collapsible Concern Flags */}
          {isOpen && !concernsLoading && (
            <>
              <div className="border-t border-border/50" />
              <div>
                <button
                  onClick={() => setConcernsExpanded(!concernsExpanded)}
                  className="flex items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Flag specific concerns
                    {totalFlags > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {totalFlags}
                      </Badge>
                    )}
                  </span>
                  {concernsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {concernsExpanded && (
                  <div className="pt-3 space-y-2">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Flag concerns">
                      {sortedFlags.map((flagType) => {
                        const count = flags[flagType] || 0;
                        const isUserFlag = userFlags.includes(flagType);
                        const { label, emoji } = CONCERN_FLAG_LABELS[flagType];
                        const isSubmittingThis = submittingFlag === flagType;

                        return (
                          <button
                            key={flagType}
                            onClick={() => connected && toggleFlag(flagType)}
                            disabled={!connected || isSubmittingThis}
                            aria-pressed={isUserFlag}
                            className={`
                              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                              transition-all duration-150 border
                              ${
                                isUserFlag
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                                  : count > 0
                                    ? 'bg-muted/50 border-border text-foreground hover:bg-muted'
                                    : 'bg-transparent border-border/50 text-muted-foreground hover:border-border hover:bg-muted/30'
                              }
                              ${connected ? 'cursor-pointer' : 'cursor-default'}
                              ${isSubmittingThis ? 'opacity-50' : ''}
                            `}
                          >
                            <span>{emoji}</span>
                            <span>{label}</span>
                            {count > 0 && (
                              <span className="ml-0.5 tabular-nums opacity-70">{count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {totalFlags === 0 && (
                      <p className="text-xs text-muted-foreground">No concerns flagged yet.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Ask Your DRep (separate card, only for delegated citizens) */}
      {isOpen && (
        <AskYourDRep txHash={txHash} proposalIndex={proposalIndex} proposalTitle={proposalTitle} />
      )}
    </div>
  );
}

function SentimentButtons({
  onVote,
  voting,
  currentVote,
}: {
  onVote: (vote: SentimentChoice) => void;
  voting: boolean;
  currentVote: SentimentChoice | null;
}) {
  const buttons: {
    vote: SentimentChoice;
    label: string;
    icon: typeof ThumbsUp;
    activeClass: string;
    hoverClass: string;
  }[] = [
    {
      vote: 'support',
      label: 'Support',
      icon: ThumbsUp,
      activeClass: 'bg-green-600 hover:bg-green-700 text-white border-green-600',
      hoverClass: 'hover:border-green-500/50 hover:bg-green-500/5',
    },
    {
      vote: 'oppose',
      label: 'Oppose',
      icon: ThumbsDown,
      activeClass: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
      hoverClass: 'hover:border-red-500/50 hover:bg-red-500/5',
    },
    {
      vote: 'unsure',
      label: 'Unsure',
      icon: HelpCircle,
      activeClass: 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600',
      hoverClass: 'hover:border-amber-500/50 hover:bg-amber-500/5',
    },
  ];

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Share your sentiment">
      {buttons.map(({ vote, label, icon: Icon, activeClass, hoverClass }) => (
        <Button
          key={vote}
          variant="outline"
          role="radio"
          aria-checked={currentVote === vote}
          className={`flex-1 gap-1.5 h-11 transition-all duration-150 ${
            currentVote === vote ? activeClass : hoverClass
          }`}
          disabled={voting}
          onClick={() => onVote(vote)}
        >
          {voting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {label}
        </Button>
      ))}
    </div>
  );
}

function SentimentBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {count} ({percent}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
