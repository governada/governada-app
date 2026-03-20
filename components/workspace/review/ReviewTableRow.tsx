'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Clock, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import { useFocusStore } from '@/lib/workspace/focus';
import type { ProposalDraft, ProposalType, ReviewQueueItem } from '@/lib/workspace/types';
import type { ReviewCardVariant } from './ReviewCard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReviewTableRowProps {
  variant: ReviewCardVariant;
  draft?: ProposalDraft;
  proposal?: ReviewQueueItem;
  itemProps?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Routing helper
// ---------------------------------------------------------------------------

function getHref(
  variant: ReviewCardVariant,
  draft?: ProposalDraft,
  proposal?: ReviewQueueItem,
): string {
  if (variant === 'feedback' && draft) {
    return `/workspace/author/${draft.id}`;
  }
  if (proposal) {
    return `/workspace/review?proposal=${encodeURIComponent(proposal.txHash)}:${proposal.proposalIndex}`;
  }
  return '/workspace/review';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewTableRow({ variant, draft, proposal, itemProps }: ReviewTableRowProps) {
  const setInputMethod = useFocusStore((s) => s.setInputMethod);
  const href = getHref(variant, draft, proposal);
  const isCompleted = variant === 'completed';

  const title =
    variant === 'feedback' ? draft?.title || 'Untitled Draft' : proposal?.title || 'Untitled';

  const proposalType =
    variant === 'feedback'
      ? draft?.proposalType
      : (proposal?.proposalType as ProposalType | undefined);

  return (
    <div
      className={cn(
        'group/row relative border-b border-border/50 last:border-b-0 transition-colors',
        isCompleted ? 'opacity-60 hover:opacity-80' : 'hover:bg-accent/40',
      )}
      {...(itemProps ?? {})}
    >
      <Link
        href={href}
        onClick={() => setInputMethod('pointer')}
        className="flex items-center gap-4 px-3 py-2.5 min-h-[44px]"
      >
        {/* Title */}
        <span className="flex-1 min-w-0 font-medium text-sm truncate">{title}</span>

        {/* Metadata */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Type badge */}
          {proposalType && (
            <Badge variant="outline" className="text-xs hidden sm:inline-flex">
              {PROPOSAL_TYPE_LABELS[proposalType] ?? proposalType}
            </Badge>
          )}

          {/* Variant-specific metadata */}
          {variant === 'feedback' && draft && <FeedbackMeta draft={draft} />}
          {variant === 'voting' && proposal && <VotingMeta proposal={proposal} />}
          {variant === 'completed' && proposal && <CompletedMeta proposal={proposal} />}
        </div>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline metadata
// ---------------------------------------------------------------------------

function FeedbackMeta({ draft }: { draft: ProposalDraft }) {
  const days = daysSince(draft.communityReviewStartedAt);

  return days !== null ? (
    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
      <Clock className="h-3 w-3" />
      {days}d
    </span>
  ) : null;
}

function VotingMeta({ proposal }: { proposal: ReviewQueueItem }) {
  const epochsRemaining = proposal.epochsRemaining;
  const isFinalEpoch = epochsRemaining != null && epochsRemaining <= 1;
  const isUrgent = epochsRemaining != null && epochsRemaining <= 3;

  // Mini DRep approval bar
  const drep = proposal.interBodyVotes?.drep;
  const totalDrep = drep ? drep.yes + drep.no + drep.abstain : 0;
  const yesPct = totalDrep > 0 && drep ? Math.round((drep.yes / totalDrep) * 100) : null;

  return (
    <div className="flex items-center gap-3">
      {/* Treasury amount */}
      {proposal.withdrawalAmount != null && (
        <span className="text-xs text-muted-foreground tabular-nums hidden lg:block">
          ₳{Number(proposal.withdrawalAmount).toLocaleString()}
        </span>
      )}

      {/* Approval % */}
      {yesPct !== null && (
        <div className="flex items-center gap-1.5 w-16">
          <div className="h-1 flex-1 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 voting-progress-live"
              style={{ width: `${yesPct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{yesPct}%</span>
        </div>
      )}

      {/* Epochs */}
      {epochsRemaining != null && (
        <span
          className={cn(
            'flex items-center gap-0.5 text-xs tabular-nums',
            isFinalEpoch
              ? 'text-red-400 font-medium'
              : isUrgent
                ? 'text-amber-400'
                : 'text-muted-foreground',
          )}
        >
          <Clock className="h-3 w-3" />
          {epochsRemaining}e
        </span>
      )}

      {/* Urgency badge */}
      {isFinalEpoch && (
        <Badge className="text-xs bg-red-500/20 text-red-400 hidden sm:inline-flex">Final!</Badge>
      )}
    </div>
  );
}

function CompletedMeta({ proposal }: { proposal: ReviewQueueItem }) {
  const vote = proposal.existingVote;

  const voteColor: Record<string, string> = {
    Yes: 'bg-emerald-500/20 text-emerald-400',
    yes: 'bg-emerald-500/20 text-emerald-400',
    No: 'bg-red-500/20 text-red-400',
    no: 'bg-red-500/20 text-red-400',
    Abstain: 'bg-muted text-muted-foreground',
    abstain: 'bg-muted text-muted-foreground',
  };

  return vote ? (
    <Badge className={cn('text-xs', voteColor[vote] ?? 'bg-muted text-muted-foreground')}>
      <Vote className="h-3 w-3 mr-1" />
      {vote}
    </Badge>
  ) : null;
}
