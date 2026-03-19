'use client';

/**
 * ReadinessPanel — Submission readiness sidebar for the proposal authoring workspace.
 *
 * JTBD: "What do I need to do to get this ready for submission?"
 *
 * Displays:
 * 1. Community Confidence composite score (bar + level badge)
 * 2. Blockers (fail checks) separated from Recommendations (warnings)
 * 3. Factor breakdown (per-dimension mini bars)
 * 4. Hover tooltips explaining each check
 */

import { useMemo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraft } from '@/hooks/useDrafts';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import { MIN_REVIEWS_FOR_SUBMISSION } from '@/lib/workspace/constants';
import {
  computeConfidence,
  confidenceLevelColor,
  confidenceLevelBg,
  type ConfidenceInput,
} from '@/lib/workspace/confidence';
import type { ProposalDraft, ConstitutionalCheckResult } from '@/lib/workspace/types';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fieldsCompleteCount(draft: ProposalDraft): number {
  return [draft.title, draft.abstract, draft.motivation, draft.rationale].filter(
    (f) => f && f.trim().length > 0,
  ).length;
}

function extractCheckScore(
  check: ConstitutionalCheckResult | null,
): 'pass' | 'warning' | 'fail' | null {
  if (!check) return null;
  return check.score;
}

function hoursInReview(communityReviewStartedAt: string | null): number | null {
  if (!communityReviewStartedAt) return null;
  const diffMs = Date.now() - new Date(communityReviewStartedAt).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

// ---------------------------------------------------------------------------
// Tooltip descriptions for each check type
// ---------------------------------------------------------------------------

const CHECK_TOOLTIPS: Record<string, string> = {
  content:
    'All four proposal fields (title, abstract, motivation, rationale) must be filled before submission. Reviewers need this context to evaluate your amendment.',
  constitutional:
    'AI analysis of your amendment against existing constitutional articles. Checks for conflicts, alignment issues, and legal consistency. Run from the Intel tab.',
  reviews:
    'Community reviews provide feedback and build confidence. More non-stale reviews signal stronger community engagement.',
  unaddressed:
    'Reviews waiting for your response. Address each review to show the community you are incorporating feedback.',
  addressed: 'All community reviews have been responded to.',
  duration:
    '48 hours of community review gives enough time for diverse perspectives. Rushing through this period may result in less thorough feedback.',
  stale:
    'Reviews made against an older version of your proposal. Consider asking these reviewers to update their feedback.',
};

// ---------------------------------------------------------------------------
// Check item component with tooltip
// ---------------------------------------------------------------------------

type CheckStatus = 'pass' | 'fail' | 'warning';

function CheckItem({
  status,
  label,
  tooltip,
}: {
  status: CheckStatus;
  label: string;
  tooltip?: string;
}) {
  const icon =
    status === 'pass' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
    ) : status === 'fail' ? (
      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
    ) : (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
    );

  return (
    <div className="group flex items-start gap-2 text-xs">
      {icon}
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground">{label}</span>
        {tooltip && (
          <div className="hidden group-hover:block mt-1 text-[10px] text-muted-foreground/60 leading-relaxed">
            {tooltip}
          </div>
        )}
      </div>
      {tooltip && (
        <Info className="h-3 w-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Factor bar component
// ---------------------------------------------------------------------------

function FactorBar({ name, value }: { name: string; value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-destructive';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground truncate">{name}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className="w-8 text-right text-muted-foreground tabular-nums">{value}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JTBD context message
// ---------------------------------------------------------------------------

function contextMessage(level: string, blockerCount: number): string {
  if (blockerCount > 0) {
    return `${blockerCount} blocker${blockerCount !== 1 ? 's' : ''} must be resolved before submission.`;
  }
  if (level === 'excellent' || level === 'ready') {
    return 'Your amendment looks ready for submission.';
  }
  return 'Address the recommendations below to strengthen your submission.';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ReadinessPanelProps {
  draftId: string;
}

export function ReadinessPanel({ draftId }: ReadinessPanelProps) {
  const { data: draftData, isLoading: draftLoading } = useDraft(draftId);
  const { data: reviewsData, isLoading: reviewsLoading } = useDraftReviews(draftId);

  const isLoading = draftLoading || reviewsLoading;

  const { confidence, blockers, recommendations } = useMemo(() => {
    if (!draftData?.draft) {
      return { confidence: null, blockers: [], recommendations: [] };
    }

    const draft = draftData.draft;
    const reviews = reviewsData?.reviews ?? [];
    const responsesByReview = reviewsData?.responsesByReview ?? {};
    const nonStaleReviewCount = reviewsData?.nonStaleReviewCount ?? 0;
    const aggregateScores = reviewsData?.aggregateScores;

    // Count reviews that have at least one response
    const respondedCount = reviews.filter((r) => (responsesByReview[r.id]?.length ?? 0) > 0).length;

    // Compute average score from aggregate scores (non-stale only from API)
    const scoreValues = aggregateScores
      ? [
          aggregateScores.impact,
          aggregateScores.feasibility,
          aggregateScores.constitutional,
          aggregateScores.value,
        ].filter((s): s is number => s !== null)
      : [];
    const averageScore =
      scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : null;

    const fieldsComplete = fieldsCompleteCount(draft);
    const constitutionalCheck = extractCheckScore(draft.lastConstitutionalCheck);

    const input: ConfidenceInput = {
      totalReviews: reviews.length,
      nonStaleReviews: nonStaleReviewCount,
      averageScore,
      respondedCount,
      totalReviewsToRespond: reviews.length,
      constitutionalCheck,
      fieldsComplete,
    };

    const result = computeConfidence(input);

    // Build checks list with tooltips, split into blockers and recommendations
    const staleCount = reviews.length - nonStaleReviewCount;
    const unaddressedCount = reviews.filter(
      (r) => (responsesByReview[r.id]?.length ?? 0) === 0,
    ).length;
    const hours = hoursInReview(draft.communityReviewStartedAt);

    type Check = { status: CheckStatus; label: string; tooltip?: string };
    const blockersList: Check[] = [];
    const recommendationsList: Check[] = [];

    // Content completeness
    const contentCheck: Check = {
      status: fieldsComplete >= 4 ? 'pass' : 'fail',
      label: `Content complete (${fieldsComplete}/4 fields)`,
      tooltip: CHECK_TOOLTIPS.content,
    };
    if (contentCheck.status === 'fail') blockersList.push(contentCheck);
    else recommendationsList.push(contentCheck);

    // Constitutional check
    const constCheck: Check = {
      status:
        constitutionalCheck === 'pass'
          ? 'pass'
          : constitutionalCheck === 'warning'
            ? 'warning'
            : 'fail',
      label: `Constitutional check: ${constitutionalCheck === 'pass' ? 'Pass' : constitutionalCheck === 'warning' ? 'Warning' : constitutionalCheck === 'fail' ? 'Fail' : 'Not run'}`,
      tooltip: CHECK_TOOLTIPS.constitutional,
    };
    if (constCheck.status === 'fail') blockersList.push(constCheck);
    else recommendationsList.push(constCheck);

    // Reviews count
    const reviewCheck: Check = {
      status: nonStaleReviewCount >= MIN_REVIEWS_FOR_SUBMISSION ? 'pass' : 'fail',
      label: `${nonStaleReviewCount} review${nonStaleReviewCount !== 1 ? 's' : ''} (min ${MIN_REVIEWS_FOR_SUBMISSION} required)`,
      tooltip: CHECK_TOOLTIPS.reviews,
    };
    if (reviewCheck.status === 'fail') blockersList.push(reviewCheck);
    else recommendationsList.push(reviewCheck);

    // Unaddressed reviews
    if (unaddressedCount > 0) {
      blockersList.push({
        status: 'fail',
        label: `${unaddressedCount} review${unaddressedCount !== 1 ? 's' : ''} unaddressed`,
        tooltip: CHECK_TOOLTIPS.unaddressed,
      });
    } else if (reviews.length > 0) {
      recommendationsList.push({
        status: 'pass',
        label: 'All reviews addressed',
        tooltip: CHECK_TOOLTIPS.addressed,
      });
    }

    // Review duration
    if (hours !== null) {
      const durationCheck: Check = {
        status: hours >= 48 ? 'pass' : 'warning',
        label:
          hours >= 48
            ? `${Math.floor(hours / 24)}d in community review`
            : `${Math.floor(hours)}h in review (48h recommended)`,
        tooltip: CHECK_TOOLTIPS.duration,
      };
      if (durationCheck.status === 'warning') recommendationsList.push(durationCheck);
      else recommendationsList.push(durationCheck);
    }

    // Stale reviews
    if (staleCount > 0) {
      recommendationsList.push({
        status: 'warning',
        label: `${staleCount} stale review${staleCount !== 1 ? 's' : ''}`,
        tooltip: CHECK_TOOLTIPS.stale,
      });
    }

    return { confidence: result, blockers: blockersList, recommendations: recommendationsList };
  }, [draftData, reviewsData]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!confidence) {
    return <div className="p-4 text-sm text-muted-foreground">No draft data available.</div>;
  }

  return (
    <div className="p-4 space-y-5">
      {/* JTBD header */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Submission Readiness
        </h3>
        <p className="text-[11px] text-muted-foreground/70">
          {contextMessage(confidence.level, blockers.length)}
        </p>
      </div>

      {/* Confidence score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Community Confidence</span>
          <span
            className={cn('text-sm font-bold tabular-nums', confidenceLevelColor(confidence.level))}
          >
            {confidence.score}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              confidenceLevelBg(confidence.level),
            )}
            style={{ width: `${confidence.score}%` }}
          />
        </div>

        {/* Level label */}
        <p className={cn('text-[11px] capitalize', confidenceLevelColor(confidence.level))}>
          {confidence.level}
        </p>
      </div>

      {/* Blockers section */}
      {blockers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="h-3 w-3" />
            Blockers
          </h4>
          <div className="space-y-2 pl-0.5">
            {blockers.map((check, i) => (
              <CheckItem
                key={`b-${i}`}
                status={check.status}
                label={check.label}
                tooltip={check.tooltip}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations section */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {blockers.length > 0 ? 'Other Checks' : 'Checks'}
          </h4>
          <div className="space-y-2 pl-0.5">
            {recommendations.map((check, i) => (
              <CheckItem
                key={`r-${i}`}
                status={check.status}
                label={check.label}
                tooltip={check.tooltip}
              />
            ))}
          </div>
        </div>
      )}

      {/* Factor breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Factor Breakdown
        </h4>
        <div className="space-y-1.5">
          {confidence.factors.map((factor) => (
            <FactorBar key={factor.name} name={factor.name} value={factor.value} />
          ))}
        </div>
      </div>
    </div>
  );
}
