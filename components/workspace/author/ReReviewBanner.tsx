'use client';

/**
 * ReReviewBanner — shown to reviewers who previously reviewed a draft that
 * has since been updated. Prompts them to re-review the new version.
 * Now includes a "Show Changes" toggle that triggers version diff display.
 */

import { useMemo, useState, useCallback } from 'react';
import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import { posthog } from '@/lib/posthog';
import type { ProposalDraft } from '@/lib/workspace/types';

interface ReReviewBannerProps {
  draft: ProposalDraft;
  viewerStakeAddress: string;
  /** Called when "Show Changes" is toggled; parent fetches version content and shows diff */
  onShowChanges?: (reviewedAtVersion: number, show: boolean) => void;
}

export function ReReviewBanner({ draft, viewerStakeAddress, onShowChanges }: ReReviewBannerProps) {
  const { data } = useDraftReviews(draft.id);
  const [showingChanges, setShowingChanges] = useState(false);

  const staleReview = useMemo(() => {
    if (!data) return null;
    return (
      data.reviews.find((r) => r.reviewerStakeAddress === viewerStakeAddress && r.isStale) ?? null
    );
  }, [data, viewerStakeAddress]);

  const handleToggleChanges = useCallback(() => {
    if (!staleReview?.reviewedAtVersion) return;
    const next = !showingChanges;
    setShowingChanges(next);
    onShowChanges?.(staleReview.reviewedAtVersion, next);
    posthog.capture('review_changes_toggled', {
      proposal_id: draft.id,
      reviewed_at_version: staleReview.reviewedAtVersion,
      showing: next,
    });
  }, [staleReview, showingChanges, onShowChanges, draft.id]);

  if (!staleReview) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm">
          You reviewed version {staleReview.reviewedAtVersion ?? '?'}. The proposal has been updated
          to version {draft.currentVersion}.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`/workspace/author/${draft.id}`}
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Re-review
            <ArrowRight className="h-3 w-3" />
          </a>
          {staleReview.reviewedAtVersion && onShowChanges && (
            <button
              onClick={handleToggleChanges}
              className="inline-flex items-center gap-1 text-xs text-amber-400/70 hover:text-amber-300 transition-colors cursor-pointer"
            >
              {showingChanges ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  Hide Changes
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Show Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
