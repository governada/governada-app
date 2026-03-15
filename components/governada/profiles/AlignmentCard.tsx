'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ProposalAlignmentResult } from '@/lib/matching/proposalAlignment';

/* ─── Types ───────────────────────────────────────────── */

interface AlignmentCardProps {
  result: ProposalAlignmentResult;
  type: 'agreement' | 'disagreement';
  className?: string;
}

/* ─── Vote badge styling ──────────────────────────────── */

const VOTE_BADGE: Record<string, { className: string }> = {
  Yes: {
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  No: { className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  Abstain: { className: 'bg-muted text-muted-foreground border-border' },
};

/* ─── Component ───────────────────────────────────────── */

export function AlignmentCard({ result, type, className }: AlignmentCardProps) {
  const borderColor =
    type === 'agreement'
      ? 'border-l-emerald-500 dark:border-l-emerald-400'
      : 'border-l-amber-500 dark:border-l-amber-400';

  const voteBadge = VOTE_BADGE[result.drepVote] ?? VOTE_BADGE.Abstain;

  const isHighConfidence = result.stanceConfidence >= 60;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 border-l-[3px] bg-card/50 px-4 py-3 space-y-1.5',
        borderColor,
        className,
      )}
    >
      {/* Proposal title */}
      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
        {result.proposalTitle}
      </p>

      {/* Badges row: vote + dimension */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', voteBadge.className)}>
          {result.drepVote}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{result.dimension}</span>
      </div>

      {/* Reason */}
      <p className="text-xs text-muted-foreground leading-relaxed">{result.reason}</p>

      {/* Confidence indicator */}
      <p className="text-[10px] text-muted-foreground/70">
        {isHighConfidence ? 'High confidence' : 'Approximate'}
      </p>
    </div>
  );
}
