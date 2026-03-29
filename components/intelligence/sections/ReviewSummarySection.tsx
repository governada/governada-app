'use client';

/**
 * ReviewSummarySection — overview of community reviews for intelligence brief.
 *
 * Shows review count, average dimensional scores, and top concern themes.
 * Renders during community_review stage at the top of the author brief.
 */

import { Loader2, Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import { useFeedbackThemes } from '@/hooks/useFeedbackThemes';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReviewSummarySectionProps {
  draftId: string;
  /** For feedback themes lookup (on-chain proposals only) */
  proposalTxHash?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewSummarySection({ draftId, proposalTxHash }: ReviewSummarySectionProps) {
  const { data: reviewData, isLoading: reviewsLoading } = useDraftReviews(draftId);
  const { themes } = useFeedbackThemes(proposalTxHash ?? null, proposalTxHash ? 0 : null);

  if (reviewsLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading review summary...</span>
      </div>
    );
  }

  const reviews = reviewData?.reviews ?? [];
  const aggregate = reviewData?.aggregateScores;
  const total = reviews.length;
  const nonStale = reviews.filter((r) => !r.isStale).length;

  // Top concerns from feedback themes
  const concerns = themes.filter((t) => t.category === 'concern').slice(0, 3);

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/60">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>No reviews yet. Share your proposal to get feedback.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Summary stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{total}</span>
          <span className="text-muted-foreground">
            review{total !== 1 ? 's' : ''}
            {nonStale < total && (
              <span className="text-amber-400 ml-1">({total - nonStale} stale)</span>
            )}
          </span>
        </div>
      </div>

      {/* Dimensional scores */}
      {aggregate && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['Impact', aggregate.impact],
              ['Feasibility', aggregate.feasibility],
              ['Constitutional', aggregate.constitutional],
              ['Value', aggregate.value],
            ] as const
          ).map(([label, score]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{label}</span>
              {score != null ? (
                <div className="flex items-center gap-1">
                  <Star
                    className={cn(
                      'h-3 w-3',
                      score >= 4
                        ? 'text-emerald-400'
                        : score >= 3
                          ? 'text-amber-400'
                          : 'text-red-400',
                    )}
                  />
                  <span className="font-medium tabular-nums">{score.toFixed(1)}</span>
                </div>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Top concerns */}
      {concerns.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1.5">
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
            Top Concerns
          </span>
          {concerns.map((theme) => (
            <div
              key={theme.id}
              className="rounded bg-amber-500/5 border border-amber-500/10 px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-foreground/80 leading-relaxed">{theme.summary}</p>
                <span className="text-[9px] text-muted-foreground/60 shrink-0">
                  {theme.endorsementCount} endorsement{theme.endorsementCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
