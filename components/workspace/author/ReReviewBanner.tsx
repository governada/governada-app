'use client';

/**
 * ReReviewBanner — shown to reviewers who previously reviewed a draft that
 * has since been updated. Prompts them to re-review the new version.
 */

import { useMemo } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import type { ProposalDraft } from '@/lib/workspace/types';

interface ReReviewBannerProps {
  draft: ProposalDraft;
  viewerStakeAddress: string;
}

export function ReReviewBanner({ draft, viewerStakeAddress }: ReReviewBannerProps) {
  const { data } = useDraftReviews(draft.id);

  const staleReview = useMemo(() => {
    if (!data) return null;
    return (
      data.reviews.find((r) => r.reviewerStakeAddress === viewerStakeAddress && r.isStale) ?? null
    );
  }, [data, viewerStakeAddress]);

  if (!staleReview) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm">
          You reviewed version {staleReview.reviewedAtVersion ?? '?'}. The proposal has been updated
          to version {draft.currentVersion}.
        </p>
        <a
          href={`/workspace/author/${draft.id}`}
          className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          Re-review
          <ArrowRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
