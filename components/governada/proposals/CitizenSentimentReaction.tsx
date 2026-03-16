'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSentimentResults, type SentimentResults } from '@/hooks/useEngagement';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CitizenSentimentReactionProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
  readOnly?: boolean;
}

const CHOICES = [
  { key: 'support', label: 'Support', color: 'bg-emerald-500' },
  { key: 'oppose', label: 'Oppose', color: 'bg-red-500' },
  { key: 'unsure', label: 'Unsure', color: 'bg-amber-500' },
] as const;

type SentimentChoice = (typeof CHOICES)[number]['key'];

/**
 * Compact one-tap sentiment micro-interaction for citizens.
 * Shows 3 pill buttons + inline results bar + social proof count.
 */
export function CitizenSentimentReaction({
  txHash,
  proposalIndex,
  isOpen,
  readOnly,
}: CitizenSentimentReactionProps) {
  const { connected } = useWallet();
  const queryClient = useQueryClient();
  const { data, isLoading } = useSentimentResults(txHash, proposalIndex);

  const community = data?.community ?? { support: 0, oppose: 0, unsure: 0, total: 0 };
  const userSentiment = data?.userSentiment ?? null;
  const total = community.total;

  const castVote = useCallback(
    async (choice: SentimentChoice) => {
      if (readOnly || !isOpen || !connected) return;

      // Optimistic update
      const queryKey = ['citizen-sentiment', txHash, proposalIndex, null];
      const previous = queryClient.getQueryData<SentimentResults>(queryKey);
      queryClient.setQueryData<SentimentResults>(queryKey, (old) => {
        if (!old) return old;
        const c = { ...old.community };
        // Remove previous vote if switching
        if (old.userSentiment && old.userSentiment !== choice) {
          c[old.userSentiment] = Math.max(0, c[old.userSentiment] - 1);
        }
        // Add new vote if not already this choice
        if (old.userSentiment !== choice) {
          c[choice] = c[choice] + 1;
          c.total = c.support + c.oppose + c.unsure;
        }
        return { ...old, community: c, userSentiment: choice, hasVoted: true };
      });

      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        const token = getStoredSession();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch('/api/engagement/sentiment/vote', {
          method: 'POST',
          headers,
          body: JSON.stringify({ proposalTxHash: txHash, proposalIndex, sentiment: choice }),
        });
      } catch {
        // Rollback on failure
        queryClient.setQueryData(queryKey, previous);
      }

      queryClient.invalidateQueries({ queryKey: ['citizen-sentiment', txHash, proposalIndex] });
    },
    [txHash, proposalIndex, readOnly, isOpen, connected, queryClient],
  );

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  const showResults = readOnly || userSentiment || !isOpen;

  return (
    <div className="space-y-2">
      {/* Pill buttons */}
      {!readOnly && isOpen && (
        <div className="flex gap-2">
          {CHOICES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() =>
                connected ? castVote(key) : window.dispatchEvent(new Event('openWalletConnect'))
              }
              className={cn(
                'flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                'border hover:opacity-90',
                userSentiment === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Results bar */}
      {showResults && total > 0 && (
        <div className="space-y-1">
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {CHOICES.map(({ key, color }) => {
              const pct = total > 0 ? (community[key] / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={key}
                  className={cn(color, 'transition-all duration-300')}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {total} citizen{total !== 1 ? 's' : ''} weighed in
          </p>
        </div>
      )}

      {/* Not connected hint */}
      {!connected && !readOnly && isOpen && (
        <p className="text-[11px] text-muted-foreground">
          <button
            className="text-primary hover:underline"
            onClick={() => window.dispatchEvent(new Event('openWalletConnect'))}
          >
            Connect
          </button>{' '}
          to share your view
        </p>
      )}
    </div>
  );
}
