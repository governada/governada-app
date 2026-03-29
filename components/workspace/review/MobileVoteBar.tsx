'use client';

import { ThumbsUp, ThumbsDown, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import type { VoteChoice } from '@/lib/voting';

interface MobileVoteBarProps {
  onVoteSelect: (vote: VoteChoice) => void;
  hasVoted: boolean;
  currentVote?: string | null;
}

const VOTE_OPTIONS: Array<{
  choice: VoteChoice;
  label: string;
  icon: typeof ThumbsUp;
  color: string;
  activeColor: string;
}> = [
  {
    choice: 'Yes',
    label: 'Yes',
    icon: ThumbsUp,
    color: 'text-[var(--vote-affirm)]',
    activeColor: 'bg-[var(--vote-affirm)]/15 border-[var(--vote-affirm)]',
  },
  {
    choice: 'No',
    label: 'No',
    icon: ThumbsDown,
    color: 'text-[var(--vote-oppose)]',
    activeColor: 'bg-[var(--vote-oppose)]/15 border-[var(--vote-oppose)]',
  },
  {
    choice: 'Abstain',
    label: 'Abstain',
    icon: MinusCircle,
    color: 'text-[var(--vote-reserve)]',
    activeColor: 'bg-[var(--vote-reserve)]/15 border-[var(--vote-reserve)]',
  },
];

/**
 * Persistent mobile vote bar — replaces the floating FAB.
 * Shows three vote buttons inline; tapping opens the full DecisionPanel sheet.
 * Only visible on mobile (<lg) and when the user hasn't voted yet.
 */
export function MobileVoteBar({ onVoteSelect, hasVoted, currentVote }: MobileVoteBarProps) {
  if (hasVoted) return null;

  return (
    <div
      className="fixed bottom-14 left-0 right-0 z-40 lg:hidden flex items-center justify-center gap-3 px-4 py-2 bg-background/95 backdrop-blur-sm border-t border-border animate-slide-up-enter"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      {VOTE_OPTIONS.map(({ choice, label, icon: Icon, color, activeColor }) => (
        <button
          key={choice}
          type="button"
          onClick={() => {
            posthog.capture('mobile_vote_bar_tapped', { choice });
            onVoteSelect(choice);
          }}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors',
            'hover:bg-muted/50 active:scale-95 transition-transform',
            color,
            currentVote === choice && activeColor,
          )}
          aria-label={`Vote ${label}`}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
