'use client';

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart3,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Info,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { resolveRewardAddress } from '@meshsdk/core';
import { hapticLight } from '@/lib/haptics';
import { useSentimentResults, type SentimentResults } from '@/hooks/useEngagement';

type SentimentChoice = 'support' | 'oppose' | 'unsure';

interface ProposalSentimentProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
}

export function ProposalSentiment({ txHash, proposalIndex, isOpen }: ProposalSentimentProps) {
  const { connected, isAuthenticated, address, delegatedDrepId, ownDRepId, authenticate } =
    useWallet();
  const {
    data: results,
    isLoading,
    refetch,
  } = useSentimentResults(txHash, proposalIndex, ownDRepId);

  const [voting, setVoting] = useState(false);
  const [changingVote, setChangingVote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVoted = results?.hasVoted ?? false;
  const userSentiment = results?.userSentiment ?? null;

  const castVote = async (sentiment: SentimentChoice) => {
    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    setVoting(true);
    setError(null);
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Vote failed');
      }

      // Refetch via TanStack Query to get fresh results
      await refetch();
      setChangingVote(false);

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
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="ring-1 ring-primary/10">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 flex-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const community = results?.community ?? { support: 0, oppose: 0, unsure: 0, total: 0 };
  const showButtons = isOpen && (!hasVoted || changingVote);

  return (
    <Card className="ring-1 ring-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Citizen Sentiment
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[260px]">
                <p className="text-xs">
                  Express your opinion on this proposal. Your DRep votes on-chain on your behalf —
                  this shows how citizens feel and helps DReps understand delegator preferences.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Always show results to everyone */}
        {community.total > 0 && (
          <ResultsView
            community={community}
            delegators={ownDRepId ? (results?.delegators ?? null) : null}
            stakeWeighted={ownDRepId ? (results?.stakeWeighted ?? null) : null}
            userSentiment={hasVoted && !changingVote ? userSentiment : null}
            isOpen={isOpen}
            onChangeVote={hasVoted && isOpen ? () => setChangingVote(true) : undefined}
          />
        )}

        {community.total === 0 && !showButtons && (
          <p className="text-sm text-muted-foreground">
            No citizen sentiment yet. Be the first to share your opinion.
          </p>
        )}

        {/* Voting buttons for connected, authenticated users */}
        {showButtons && connected && (
          <SentimentButtons
            onVote={castVote}
            voting={voting}
            currentVote={changingVote ? userSentiment : null}
          />
        )}

        {/* CTA for unconnected users */}
        {!connected && isOpen && !hasVoted && (
          <div className="relative">
            <div className="opacity-30 pointer-events-none blur-[1px]">
              <SentimentButtons onVote={() => {}} voting={false} currentVote={null} />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <p className="text-sm font-medium">Share your opinion</p>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const event = new CustomEvent('open-wallet-modal');
                  window.dispatchEvent(event);
                }}
              >
                <Wallet className="h-3.5 w-3.5" />
                Connect Wallet to Vote
              </Button>
            </div>
          </div>
        )}

        <div aria-live="polite" role="status">
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
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
    <div
      className="flex gap-2"
      role="radiogroup"
      aria-label="Share your sentiment on this proposal"
    >
      {buttons.map(({ vote, label, icon: Icon, activeClass, hoverClass }) => (
        <Button
          key={vote}
          variant="outline"
          role="radio"
          aria-checked={currentVote === vote}
          className={`flex-1 gap-1.5 h-11 transition-all duration-150 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] ${
            currentVote === vote ? activeClass : hoverClass
          }`}
          disabled={voting}
          onClick={() => onVote(vote)}
        >
          {voting ? (
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Icon className="h-4 w-4" aria-hidden="true" />
          )}
          {label}
        </Button>
      ))}
    </div>
  );
}

function ResultsView({
  community,
  delegators,
  stakeWeighted,
  userSentiment,
  isOpen,
  onChangeVote,
}: {
  community: SentimentResults['community'];
  delegators: SentimentResults['delegators'] | null;
  stakeWeighted: SentimentResults['stakeWeighted'] | null;
  userSentiment: SentimentChoice | null;
  isOpen: boolean;
  onChangeVote?: () => void;
}) {
  const total = community.total;
  const sp = total > 0 ? Math.round((community.support / total) * 100) : 0;
  const op = total > 0 ? Math.round((community.oppose / total) * 100) : 0;
  const up = total > 0 ? Math.round((community.unsure / total) * 100) : 0;

  const labelMap: Record<SentimentChoice, string> = {
    support: 'Support',
    oppose: 'Oppose',
    unsure: 'Unsure',
  };

  return (
    <div className="space-y-3" aria-live="polite">
      {userSentiment && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <span>
            You voted <strong>{labelMap[userSentiment]}</strong>.
          </span>
        </div>
      )}

      {/* DRep delegator sentiment (only shown to DReps) */}
      {delegators && delegators.total > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">Your Delegators</p>
          <SentimentBar
            label="Support"
            count={delegators.support}
            percent={
              delegators.total > 0 ? Math.round((delegators.support / delegators.total) * 100) : 0
            }
            color="bg-green-500"
          />
          <SentimentBar
            label="Oppose"
            count={delegators.oppose}
            percent={
              delegators.total > 0 ? Math.round((delegators.oppose / delegators.total) * 100) : 0
            }
            color="bg-red-500"
          />
          <SentimentBar
            label="Unsure"
            count={delegators.unsure}
            percent={
              delegators.total > 0 ? Math.round((delegators.unsure / delegators.total) * 100) : 0
            }
            color="bg-amber-500"
          />
          <p className="text-xs text-muted-foreground">
            {delegators.total} of your delegator{delegators.total !== 1 ? 's' : ''} voted
            {stakeWeighted && stakeWeighted.total > 0 && (
              <span>
                {' '}
                &middot; stake-weighted:{' '}
                {Math.round((stakeWeighted.support / stakeWeighted.total) * 100)}% support
              </span>
            )}
          </p>
        </div>
      )}

      {/* Community-wide sentiment */}
      {delegators && delegators.total > 0 && (
        <p className="text-xs font-semibold text-muted-foreground pt-1">All Citizens</p>
      )}
      <SentimentBar label="Support" count={community.support} percent={sp} color="bg-green-500" />
      <SentimentBar label="Oppose" count={community.oppose} percent={op} color="bg-red-500" />
      <SentimentBar label="Unsure" count={community.unsure} percent={up} color="bg-amber-500" />

      <p className="text-xs text-muted-foreground">
        {total} citizen{total !== 1 ? 's' : ''} shared their opinion
      </p>

      {isOpen && userSentiment && onChangeVote && (
        <button
          onClick={onChangeVote}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Change your vote
        </button>
      )}
    </div>
  );
}

function SentimentBar({
  label,
  count,
  percent,
  color,
}: {
  label: string;
  count: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {count} ({percent}%)
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${count} votes, ${percent}%`}
      >
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
