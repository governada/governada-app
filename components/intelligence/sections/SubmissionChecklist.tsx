'use client';

/**
 * SubmissionChecklist — explicit gate checklist for final_comment stage.
 *
 * Shows pass/fail status for each submission requirement:
 * content completeness, constitutional compliance, minimum reviews, feedback addressed.
 */

import { useMemo } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import { useFeedbackThemes } from '@/hooks/useFeedbackThemes';
import { posthog } from '@/lib/posthog';
import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SubmissionChecklistProps {
  draftId: string;
  /** From ambient constitutional check */
  constitutionalScore: 'pass' | 'warning' | 'fail' | null;
  /** Number of completed content fields (0-4) */
  fieldsComplete: number;
  /** For feedback themes (on-chain proposals) */
  proposalTxHash?: string | null;
}

// ---------------------------------------------------------------------------
// Gate definition
// ---------------------------------------------------------------------------

interface Gate {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'loading';
  detail: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubmissionChecklist({
  draftId,
  constitutionalScore,
  fieldsComplete,
  proposalTxHash,
}: SubmissionChecklistProps) {
  const { data: reviewData, isLoading: reviewsLoading } = useDraftReviews(draftId);
  const { themes, isLoading: themesLoading } = useFeedbackThemes(
    proposalTxHash ?? null,
    proposalTxHash ? 0 : null,
  );

  useEffect(() => {
    posthog.capture('submission_checklist_viewed', { draft_id: draftId });
  }, [draftId]);

  const gates = useMemo((): Gate[] => {
    const reviews = reviewData?.reviews ?? [];
    const nonStale = reviews.filter((r) => !r.isStale);
    const openThemes = themes.filter((t) => t.addressedStatus === 'open');

    return [
      {
        id: 'content',
        label: 'Content Complete',
        status: fieldsComplete >= 4 ? 'pass' : 'fail',
        detail:
          fieldsComplete >= 4 ? 'All 4 sections filled' : `${fieldsComplete}/4 sections complete`,
      },
      {
        id: 'constitutional',
        label: 'Constitutional Compliance',
        status:
          constitutionalScore === null
            ? 'loading'
            : constitutionalScore === 'pass'
              ? 'pass'
              : 'fail',
        detail:
          constitutionalScore === 'pass'
            ? 'No constitutional issues'
            : constitutionalScore === 'warning'
              ? 'Warnings identified — review recommended'
              : constitutionalScore === 'fail'
                ? 'Critical issues must be resolved'
                : 'Check pending...',
      },
      {
        id: 'reviews',
        label: 'Minimum Reviews',
        status: reviewsLoading ? 'loading' : nonStale.length >= 3 ? 'pass' : 'fail',
        detail: reviewsLoading
          ? 'Loading...'
          : `${nonStale.length} current review${nonStale.length !== 1 ? 's' : ''} (3 recommended)`,
      },
      {
        id: 'feedback',
        label: 'Feedback Addressed',
        status: themesLoading
          ? 'loading'
          : themes.length === 0
            ? 'pass'
            : openThemes.length === 0
              ? 'pass'
              : 'fail',
        detail: themesLoading
          ? 'Loading...'
          : themes.length === 0
            ? 'No feedback themes'
            : openThemes.length === 0
              ? 'All feedback addressed'
              : `${openThemes.length} theme${openThemes.length !== 1 ? 's' : ''} still open`,
      },
    ];
  }, [fieldsComplete, constitutionalScore, reviewData, reviewsLoading, themes, themesLoading]);

  const allPassing = gates.every((g) => g.status === 'pass');

  return (
    <div className="space-y-3 text-xs">
      {/* Summary */}
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-center font-medium',
          allPassing
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        )}
      >
        {allPassing ? 'Ready for submission' : 'Some requirements need attention'}
      </div>

      {/* Gate list */}
      <div className="space-y-1.5">
        {gates.map((gate) => (
          <div key={gate.id} className="flex items-start gap-2 py-1">
            {gate.status === 'loading' ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            ) : gate.status === 'pass' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-foreground">{gate.label}</p>
              <p className="text-muted-foreground/60 text-[11px]">{gate.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
