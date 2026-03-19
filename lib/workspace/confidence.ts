/**
 * Community Confidence Composite — pure computation of proposal readiness.
 *
 * Computes a 0-100 confidence score from review, constitutional, and content
 * signals. Used by ReadinessPanel in the author workspace sidebar.
 *
 * All inputs are plain values (no hooks, no side effects) so this module is
 * fully testable in isolation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfidenceFactor {
  name: string;
  /** Normalized value 0-100 */
  value: number;
  /** Weight 0-1 */
  weight: number;
  /** Human-readable detail, e.g. "5 reviews (3 required)" */
  detail: string;
}

export interface ConfidenceResult {
  /** Composite score 0-100 */
  score: number;
  level: 'low' | 'moderate' | 'high' | 'strong';
  factors: ConfidenceFactor[];
}

export interface ConfidenceInput {
  totalReviews: number;
  nonStaleReviews: number;
  /** Average review score on 1-5 scale, null if no reviews scored */
  averageScore: number | null;
  respondedCount: number;
  totalReviewsToRespond: number;
  constitutionalCheck: 'pass' | 'warning' | 'fail' | null;
  /** Count of non-empty fields among title, abstract, motivation, rationale (0-4) */
  fieldsComplete: number;
}

// ---------------------------------------------------------------------------
// Factor computation helpers
// ---------------------------------------------------------------------------

/** Linear interpolation: maps `value` in [lo, hi] to [0, 100], clamped. */
function lerp(value: number, lo: number, hi: number): number {
  if (hi <= lo) return value >= hi ? 100 : 0;
  const t = (value - lo) / (hi - lo);
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute the Community Confidence Composite score.
 *
 * Factor weights and scaling:
 *
 * | Factor                | Weight | 0%     | 50%    | 100%    |
 * |-----------------------|--------|--------|--------|---------|
 * | Review count (fresh)  | 0.30   | 0      | 2      | 5+      |
 * | Average score         | 0.30   | < 2.0  | 3.0    | >= 4.0  |
 * | Response completeness | 0.20   | 0%     | 50%    | 100%    |
 * | Constitutional check  | 0.10   | fail   | warn   | pass    |
 * | Content completeness  | 0.10   | <2     | 3      | 4       |
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  // 1. Review count (non-stale)
  const reviewCountValue = lerp(input.nonStaleReviews, 0, 5);
  const reviewCountFactor: ConfidenceFactor = {
    name: 'Review Count',
    value: reviewCountValue,
    weight: 0.3,
    detail:
      input.nonStaleReviews === input.totalReviews
        ? `${input.nonStaleReviews} review${input.nonStaleReviews !== 1 ? 's' : ''}`
        : `${input.nonStaleReviews} current (${input.totalReviews} total)`,
  };

  // 2. Average score (1-5 scale -> 0-100 with 2.0 = 0%, 4.0 = 100%)
  const avgScoreValue = input.averageScore !== null ? lerp(input.averageScore, 2.0, 4.0) : 0;
  const avgScoreFactor: ConfidenceFactor = {
    name: 'Average Score',
    value: avgScoreValue,
    weight: 0.3,
    detail:
      input.averageScore !== null ? `${input.averageScore.toFixed(1)} / 5.0` : 'No scores yet',
  };

  // 3. Response completeness
  const responsePct =
    input.totalReviewsToRespond > 0
      ? (input.respondedCount / input.totalReviewsToRespond) * 100
      : input.totalReviews > 0
        ? 0
        : 100; // No reviews = nothing to respond to, treat as complete
  const responseValue = Math.round(Math.max(0, Math.min(100, responsePct)));
  const responseFactor: ConfidenceFactor = {
    name: 'Responses',
    value: responseValue,
    weight: 0.2,
    detail:
      input.totalReviewsToRespond > 0
        ? `${input.respondedCount}/${input.totalReviewsToRespond} addressed`
        : 'No reviews to address',
  };

  // 4. Constitutional check
  let constitutionalValue: number;
  let constitutionalDetail: string;
  switch (input.constitutionalCheck) {
    case 'pass':
      constitutionalValue = 100;
      constitutionalDetail = 'Pass';
      break;
    case 'warning':
      constitutionalValue = 50;
      constitutionalDetail = 'Warning';
      break;
    case 'fail':
      constitutionalValue = 0;
      constitutionalDetail = 'Fail';
      break;
    default:
      constitutionalValue = 0;
      constitutionalDetail = 'Not run';
  }
  const constitutionalFactor: ConfidenceFactor = {
    name: 'Constitutional',
    value: constitutionalValue,
    weight: 0.1,
    detail: constitutionalDetail,
  };

  // 5. Content completeness (0-4 fields)
  const completenessValue = lerp(input.fieldsComplete, 1, 4);
  const completenessFactor: ConfidenceFactor = {
    name: 'Completeness',
    value: completenessValue,
    weight: 0.1,
    detail: `${input.fieldsComplete}/4 fields`,
  };

  const factors = [
    reviewCountFactor,
    avgScoreFactor,
    responseFactor,
    constitutionalFactor,
    completenessFactor,
  ];

  // Weighted sum
  const score = Math.round(factors.reduce((sum, f) => sum + f.value * f.weight, 0));

  // Level mapping
  let level: ConfidenceResult['level'];
  if (score <= 30) level = 'low';
  else if (score <= 60) level = 'moderate';
  else if (score <= 80) level = 'high';
  else level = 'strong';

  return { score, level, factors };
}

// ---------------------------------------------------------------------------
// Level color helpers (for UI components)
// ---------------------------------------------------------------------------

/** Returns a Tailwind text color class for the given confidence level. */
export function confidenceLevelColor(level: ConfidenceResult['level']): string {
  switch (level) {
    case 'strong':
      return 'text-emerald-400';
    case 'high':
      return 'text-teal-400';
    case 'moderate':
      return 'text-amber-400';
    case 'low':
      return 'text-destructive';
  }
}

/** Returns a Tailwind background color class for the progress bar fill. */
export function confidenceLevelBg(level: ConfidenceResult['level']): string {
  switch (level) {
    case 'strong':
      return 'bg-emerald-500';
    case 'high':
      return 'bg-teal-500';
    case 'moderate':
      return 'bg-amber-500';
    case 'low':
      return 'bg-destructive';
  }
}
