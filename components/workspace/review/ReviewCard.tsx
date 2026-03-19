'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, useReducedMotion } from 'framer-motion';
import { Clock, AlertTriangle, CheckCircle2, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROPOSAL_TYPE_LABELS } from '@/lib/workspace/types';
import { useFocusStore } from '@/lib/workspace/focus';
import type {
  ProposalDraft,
  ProposalType,
  ReviewQueueItem,
  DraftStatus,
} from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysInReview(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: 'Draft',
  community_review: 'Community Review',
  response_revision: 'Response & Revision',
  final_comment: 'Final Comment',
  submitted: 'Submitted',
  archived: 'Archived',
};

const STATUS_COLORS: Record<string, string> = {
  community_review: 'bg-blue-900/30 text-blue-400',
  response_revision: 'bg-amber-900/30 text-amber-400',
  final_comment: 'bg-purple-900/30 text-purple-400',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewCardVariant = 'feedback' | 'voting' | 'completed';

interface ReviewCardProps {
  variant: ReviewCardVariant;
  /** For feedback variant: community draft needing review */
  draft?: ProposalDraft;
  /** For voting/completed variant: on-chain proposal */
  proposal?: ReviewQueueItem;
  /** Index for staggered animation */
  index: number;
  /** Props from useFocusableList for keyboard navigation */
  itemProps?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewCard({ variant, draft, proposal, index, itemProps }: ReviewCardProps) {
  const setInputMethod = useFocusStore((s) => s.setInputMethod);
  const prefersReducedMotion = useReducedMotion();

  // Determine the link destination
  const href = getHref(variant, draft, proposal);

  // Mute completed cards
  const isCompleted = variant === 'completed';

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index, 10) * 0.05,
        duration: 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Card
        className={cn(
          'h-full transition-colors group/card relative',
          isCompleted ? 'opacity-60' : 'hover:bg-accent/50',
        )}
        {...(itemProps ?? {})}
      >
        <Link
          href={href}
          onClick={() => setInputMethod('pointer')}
          className="block cursor-pointer"
        >
          <CardContent className="space-y-3" style={{ padding: 'var(--workspace-card-padding)' }}>
            {variant === 'feedback' && draft && <FeedbackContent draft={draft} />}
            {variant === 'voting' && proposal && <VotingContent proposal={proposal} />}
            {variant === 'completed' && proposal && <CompletedContent proposal={proposal} />}
          </CardContent>
        </Link>
      </Card>
    </motion.div>
  );
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
// Feedback variant (community drafts)
// ---------------------------------------------------------------------------

function FeedbackContent({ draft }: { draft: ProposalDraft }) {
  const days = daysInReview(draft.communityReviewStartedAt);

  return (
    <>
      {/* Title */}
      <h3
        className="font-medium line-clamp-2"
        style={{
          fontSize: 'var(--workspace-font-size)',
          lineHeight: 'var(--workspace-line-height)',
        }}
      >
        {draft.title || 'Untitled Draft'}
      </h3>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {PROPOSAL_TYPE_LABELS[draft.proposalType] ?? draft.proposalType}
        </Badge>
        <Badge
          className={cn('text-xs', STATUS_COLORS[draft.status] ?? 'bg-muted text-muted-foreground')}
        >
          {STATUS_LABELS[draft.status] ?? draft.status}
        </Badge>
      </div>

      {/* Days in review */}
      {days !== null && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{days}d in review</span>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Voting variant (on-chain proposals needing your vote)
// ---------------------------------------------------------------------------

function VotingContent({ proposal }: { proposal: ReviewQueueItem }) {
  const epochsRemaining = proposal.epochsRemaining;
  const isFinalEpoch = epochsRemaining != null && epochsRemaining <= 1;
  const isUrgent = epochsRemaining != null && epochsRemaining <= 3;

  // Mini voting progress bar — DRep yes% of total
  const drep = proposal.interBodyVotes?.drep;
  const totalDrep = drep ? drep.yes + drep.no + drep.abstain : 0;
  const yesPct = totalDrep > 0 && drep ? Math.round((drep.yes / totalDrep) * 100) : 0;

  return (
    <>
      {/* Title + urgency */}
      <div className="flex items-start justify-between gap-2">
        <h3
          className="font-medium line-clamp-2"
          style={{
            fontSize: 'var(--workspace-font-size)',
            lineHeight: 'var(--workspace-line-height)',
          }}
        >
          {proposal.title || 'Untitled'}
        </h3>
        {isFinalEpoch && (
          <Badge className="shrink-0 bg-red-500/20 text-red-400 text-xs">Final epoch!</Badge>
        )}
        {!isFinalEpoch && isUrgent && (
          <Badge className="shrink-0 bg-amber-500/20 text-amber-400 text-xs">Urgent</Badge>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {PROPOSAL_TYPE_LABELS[proposal.proposalType as ProposalType] ?? proposal.proposalType}
        </Badge>
      </div>

      {/* DRep voting progress */}
      {totalDrep > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>DRep approval</span>
            <span className="tabular-nums">{yesPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${yesPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Epochs remaining + treasury */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {epochsRemaining != null && (
          <span className={cn('flex items-center gap-1', isFinalEpoch && 'text-red-400')}>
            <Clock className="h-3 w-3" />
            {epochsRemaining} epoch{epochsRemaining !== 1 ? 's' : ''}
          </span>
        )}
        {proposal.withdrawalAmount != null && (
          <span className="tabular-nums">
            ₳{Number(proposal.withdrawalAmount).toLocaleString()}
          </span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Completed variant
// ---------------------------------------------------------------------------

function CompletedContent({ proposal }: { proposal: ReviewQueueItem }) {
  const vote = proposal.existingVote;

  const voteColor: Record<string, string> = {
    Yes: 'bg-emerald-500/20 text-emerald-400',
    yes: 'bg-emerald-500/20 text-emerald-400',
    No: 'bg-red-500/20 text-red-400',
    no: 'bg-red-500/20 text-red-400',
    Abstain: 'bg-muted text-muted-foreground',
    abstain: 'bg-muted text-muted-foreground',
  };

  return (
    <>
      {/* Title */}
      <h3
        className="font-medium line-clamp-2"
        style={{
          fontSize: 'var(--workspace-font-size)',
          lineHeight: 'var(--workspace-line-height)',
        }}
      >
        {proposal.title || 'Untitled'}
      </h3>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {PROPOSAL_TYPE_LABELS[proposal.proposalType as ProposalType] ?? proposal.proposalType}
        </Badge>
        {vote && (
          <Badge className={cn('text-xs', voteColor[vote] ?? 'bg-muted text-muted-foreground')}>
            <Vote className="h-3 w-3 mr-1" />
            Voted {vote}
          </Badge>
        )}
        {!vote && (
          <Badge className="text-xs bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Reviewed
          </Badge>
        )}
      </div>

      {/* Epochs remaining (if still in voting) */}
      {proposal.epochsRemaining != null && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>
            {proposal.epochsRemaining} epoch{proposal.epochsRemaining !== 1 ? 's' : ''} remaining
          </span>
        </div>
      )}
    </>
  );
}
