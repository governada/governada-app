'use client';

/**
 * ReadinessSection — community confidence radial score for intelligence brief.
 *
 * Reuses computeConfidence() from lib/workspace/confidence.ts and renders
 * a visual radial gauge with factor breakdown.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  computeConfidence,
  type ConfidenceInput,
  type ConfidenceResult,
} from '@/lib/workspace/confidence';
import { useDraftReviews } from '@/hooks/useDraftReviews';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReadinessSectionProps {
  draftId: string;
  /** Pre-computed constitutional check result */
  constitutionalCheck: 'pass' | 'warning' | 'fail' | null;
  /** Content completeness (0-4) */
  fieldsComplete: number;
}

// ---------------------------------------------------------------------------
// Radial gauge
// ---------------------------------------------------------------------------

function RadialGauge({ score, level }: { score: number; level: ConfidenceResult['level'] }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color =
    level === 'strong'
      ? 'var(--compass-teal)'
      : level === 'high'
        ? 'var(--compass-teal)'
        : level === 'moderate'
          ? 'var(--compass-amber)'
          : 'var(--compass-red, #ef4444)';

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/20"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{level}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReadinessSection({
  draftId,
  constitutionalCheck,
  fieldsComplete,
}: ReadinessSectionProps) {
  const { data: reviewData } = useDraftReviews(draftId);

  const confidence = useMemo((): ConfidenceResult => {
    const reviews = reviewData?.reviews ?? [];
    const nonStale = reviews.filter((r) => !r.isStale);
    const responsesByReview = reviewData?.responsesByReview ?? {};
    // Average score from the 4 dimension scores (impact, feasibility, constitutional, value)
    const allScores: number[] = [];
    for (const r of reviews) {
      const dims = [r.impactScore, r.feasibilityScore, r.constitutionalScore, r.valueScore].filter(
        (s): s is number => s != null,
      );
      if (dims.length > 0) allScores.push(dims.reduce((a, b) => a + b, 0) / dims.length);
    }
    const avgScore =
      allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
    // Count reviews that have at least one response
    const responded = reviews.filter((r) => (responsesByReview[r.id]?.length ?? 0) > 0).length;

    const input: ConfidenceInput = {
      totalReviews: reviews.length,
      nonStaleReviews: nonStale.length,
      averageScore: avgScore,
      respondedCount: responded,
      totalReviewsToRespond: reviews.length,
      constitutionalCheck,
      fieldsComplete,
    };

    return computeConfidence(input);
  }, [reviewData, constitutionalCheck, fieldsComplete]);

  return (
    <div className="space-y-3 text-xs">
      <RadialGauge score={confidence.score} level={confidence.level} />

      <div className="space-y-1.5">
        {confidence.factors.map((factor) => (
          <div key={factor.name} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-muted-foreground truncate">{factor.name}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0 ml-2">
                  {factor.detail}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    factor.value >= 70
                      ? 'bg-emerald-500'
                      : factor.value >= 40
                        ? 'bg-amber-500'
                        : 'bg-red-500',
                  )}
                  style={{ width: `${factor.value}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
