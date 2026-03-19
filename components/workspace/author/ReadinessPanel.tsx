'use client';

/**
 * ReadinessPanel — Submission readiness sidebar for the proposal authoring workspace.
 *
 * Displays:
 * 1. Community Confidence composite score (bar + level badge)
 * 2. Readiness checks (pass/fail/warning list)
 * 3. Factor breakdown (per-dimension mini bars)
 *
 * All confidence computation is delegated to the pure `computeConfidence()` function.
 */

import { useMemo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
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
// Check item component
// ---------------------------------------------------------------------------

type CheckStatus = 'pass' | 'fail' | 'warning';

function CheckItem({ status, label }: { status: CheckStatus; label: string }) {
  const icon =
    status === 'pass' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
    ) : status === 'fail' ? (
      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
    ) : (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
    );

  return (
    <div className="flex items-start gap-2 text-xs">
      {icon}
      <span className="text-muted-foreground">{label}</span>
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
// Main component
// ---------------------------------------------------------------------------

interface ReadinessPanelProps {
  draftId: string;
}

export function ReadinessPanel({ draftId }: ReadinessPanelProps) {
  const { data: draftData, isLoading: draftLoading } = useDraft(draftId);
  const { data: reviewsData, isLoading: reviewsLoading } = useDraftReviews(draftId);

  const isLoading = draftLoading || reviewsLoading;

  const { confidence, checks } = useMemo(() => {
    if (!draftData?.draft) {
      return { confidence: null, checks: [] };
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

    // Build checks list
    const staleCount = reviews.length - nonStaleReviewCount;
    const unaddressedCount = reviews.filter(
      (r) => (responsesByReview[r.id]?.length ?? 0) === 0,
    ).length;
    const hours = hoursInReview(draft.communityReviewStartedAt);

    type Check = { status: CheckStatus; label: string };
    const checksList: Check[] = [
      {
        status: fieldsComplete >= 4 ? 'pass' : 'fail',
        label: `Content complete (${fieldsComplete}/4 fields)`,
      },
      {
        status:
          constitutionalCheck === 'pass'
            ? 'pass'
            : constitutionalCheck === 'warning'
              ? 'warning'
              : constitutionalCheck === 'fail'
                ? 'fail'
                : 'fail',
        label: `Constitutional check: ${constitutionalCheck === 'pass' ? 'Pass' : constitutionalCheck === 'warning' ? 'Warning' : constitutionalCheck === 'fail' ? 'Fail' : 'Not run'}`,
      },
      {
        status: nonStaleReviewCount >= MIN_REVIEWS_FOR_SUBMISSION ? 'pass' : 'fail',
        label: `${nonStaleReviewCount} review${nonStaleReviewCount !== 1 ? 's' : ''} (min ${MIN_REVIEWS_FOR_SUBMISSION} required)`,
      },
    ];

    if (unaddressedCount > 0) {
      checksList.push({
        status: 'fail',
        label: `${unaddressedCount} review${unaddressedCount !== 1 ? 's' : ''} unaddressed`,
      });
    } else if (reviews.length > 0) {
      checksList.push({
        status: 'pass',
        label: 'All reviews addressed',
      });
    }

    if (hours !== null) {
      checksList.push({
        status: hours >= 48 ? 'pass' : 'warning',
        label:
          hours >= 48
            ? `${Math.floor(hours / 24)}d in community review`
            : `${Math.floor(hours)}h in review (48h recommended)`,
      });
    }

    if (staleCount > 0) {
      checksList.push({
        status: 'warning',
        label: `${staleCount} stale review${staleCount !== 1 ? 's' : ''}`,
      });
    }

    return { confidence: result, checks: checksList };
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
      {/* Confidence score header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Community Confidence</h3>
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
        <p className={cn('text-xs capitalize', confidenceLevelColor(confidence.level))}>
          {confidence.level}
        </p>
      </div>

      {/* Checks section */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Checks
        </h4>
        <div className="space-y-1.5">
          {checks.map((check, i) => (
            <CheckItem key={i} status={check.status} label={check.label} />
          ))}
        </div>
      </div>

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
