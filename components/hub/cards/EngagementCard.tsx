'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { resolveRewardAddress } from '@meshsdk/core';
import { hapticLight } from '@/lib/haptics';
import { HubCardSkeleton, HubCardError } from './HubCard';
import { Button } from '@/components/ui/button';
import { useDepthConfig } from '@/hooks/useDepthConfig';

type SentimentChoice = 'support' | 'oppose' | 'unsure';

interface ActivePoll {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  voteCount: number;
}

interface SentimentResults {
  community: { support: number; oppose: number; unsure: number; total: number };
  userSentiment: SentimentChoice | null;
  hasVoted: boolean;
}

/**
 * EngagementCard -- Active engagement opportunities with inline sentiment voting.
 *
 * Shows the most relevant proposal needing citizen input. If the user hasn't
 * voted on it, they can cast support/oppose/unsure directly from the Hub.
 *
 * JTBD: "Is there something I can weigh in on?"
 */
export function EngagementCard() {
  const {
    data: pollsRaw,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['active-polls-hub'],
    queryFn: async () => {
      const res = await fetch('/api/governance/pulse');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <HubCardSkeleton />;
  if (isError) return <HubCardError message="Couldn't load engagement" onRetry={() => refetch()} />;

  const pulse = pollsRaw as Record<string, unknown> | undefined;
  const activePolls = (pulse?.activePolls as ActivePoll[]) ?? [];
  const activeProposals = (pulse?.activeProposals as number) ?? 0;

  // No engagement opportunities -- don't render
  if (activePolls.length === 0 && activeProposals === 0) return null;

  const activePoll = activePolls[0];

  // If we have an active poll, show the enhanced card with inline voting
  if (activePoll) {
    return (
      <InlineSentimentCard
        txHash={activePoll.txHash}
        proposalIndex={activePoll.index}
        title={activePoll.title}
        voteCount={activePoll.voteCount}
      />
    );
  }

  // Fallback: just show active proposal count
  return (
    <Link
      href="/governance/proposals"
      aria-label={`${activeProposals} active proposals`}
      className={cn(
        'group block min-h-[6.5rem] rounded-2xl border p-4 sm:p-5',
        'transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'border-white/[0.08] bg-card/15 backdrop-blur-md',
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your Voice
          </span>
        </div>
        <p className="text-base font-semibold text-foreground">
          {activeProposals} proposal{activeProposals !== 1 ? 's' : ''} being decided
        </p>
        <p className="text-sm text-muted-foreground">Share your perspective on active governance</p>
      </div>
    </Link>
  );
}

/** Inline sentiment voting card for the Hub feed. */
function InlineSentimentCard({
  txHash,
  proposalIndex,
  title,
  voteCount,
}: {
  txHash: string;
  proposalIndex: number;
  title: string;
  voteCount: number;
}) {
  const { connected, isAuthenticated, address, delegatedDrepId, authenticate } = useWallet();
  const queryClient = useQueryClient();
  const { showSentiment } = useDepthConfig('hub');
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current sentiment for this proposal
  const { data: sentimentData } = useQuery<SentimentResults>({
    queryKey: ['hub-sentiment', txHash, proposalIndex],
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getStoredSession();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(
        `/api/engagement/sentiment/results?proposalTxHash=${txHash}&proposalIndex=${proposalIndex}`,
        { headers },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const hasVoted = sentimentData?.hasVoted ?? false;
  const userSentiment = sentimentData?.userSentiment ?? null;
  const community = sentimentData?.community ?? { support: 0, oppose: 0, unsure: 0, total: 0 };

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

      if (res.status === 429) {
        throw new Error('Vote limit reached for this epoch.');
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Vote failed');
      }

      // Invalidate to refetch results
      await queryClient.invalidateQueries({ queryKey: ['hub-sentiment', txHash, proposalIndex] });
      await queryClient.invalidateQueries({ queryKey: ['citizen-sentiment'] });

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_sentiment_voted_hub', {
            proposal_tx_hash: txHash,
            proposal_index: proposalIndex,
            sentiment,
            source: 'hub_card',
          });
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  const supportPct =
    community.total > 0 ? Math.round((community.support / community.total) * 100) : 0;

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 sm:p-5 space-y-3',
        'border-white/[0.08] bg-card/15 backdrop-blur-md',
      )}
    >
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Voice
        </span>
      </div>

      <Link href={`/proposal/${txHash}/${proposalIndex}`} className="block group">
        <p className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {title}
        </p>
      </Link>

      {/* Community signal bar */}
      {community.total > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${supportPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {community.total} citizen{community.total !== 1 ? 's' : ''} voted &middot; {supportPct}%
            support
          </p>
        </div>
      )}

      {community.total === 0 && (
        <p className="text-xs text-muted-foreground">
          {voteCount > 0
            ? `${voteCount} citizen${voteCount !== 1 ? 's' : ''} voted`
            : 'Be the first to share your opinion'}
        </p>
      )}

      {/* Already voted state */}
      {hasVoted && userSentiment && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>
              You voted <strong className="capitalize">{userSentiment}</strong>
            </span>
          </div>
          <Link
            href={`/proposal/${txHash}/${proposalIndex}`}
            className="text-xs text-primary hover:underline"
          >
            View details
          </Link>
        </div>
      )}

      {/* Inline voting buttons for engaged+ connected users who haven't voted */}
      {!hasVoted && connected && showSentiment && (
        <div className="flex gap-2" role="radiogroup" aria-label="Share your sentiment">
          {[
            {
              vote: 'support' as SentimentChoice,
              label: 'Support',
              icon: ThumbsUp,
              cls: 'hover:border-green-500/50 hover:bg-green-500/5',
            },
            {
              vote: 'oppose' as SentimentChoice,
              label: 'Oppose',
              icon: ThumbsDown,
              cls: 'hover:border-red-500/50 hover:bg-red-500/5',
            },
            {
              vote: 'unsure' as SentimentChoice,
              label: 'Unsure',
              icon: HelpCircle,
              cls: 'hover:border-amber-500/50 hover:bg-amber-500/5',
            },
          ].map(({ vote, label, icon: Icon, cls }) => (
            <button
              key={vote}
              onClick={(e) => {
                e.preventDefault();
                castVote(vote);
              }}
              disabled={voting}
              role="radio"
              aria-checked={false}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 px-2 py-2 text-xs font-medium',
                'transition-all duration-150 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                cls,
              )}
            >
              {voting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* CTA for unconnected users (engaged+ only) */}
      {!hasVoted && !connected && showSentiment && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1.5 text-xs"
          onClick={() => {
            const event = new CustomEvent('openWalletConnect');
            window.dispatchEvent(event);
          }}
        >
          <Wallet className="h-3.5 w-3.5" />
          Connect to share your opinion
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
