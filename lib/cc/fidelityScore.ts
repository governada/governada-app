/**
 * Constitutional Fidelity Score for CC Members.
 *
 * Measures how well a CC member fulfills their constitutional role,
 * NOT how often they agree with DReps.
 *
 * Four pillars:
 * 1. Rationale Provision (20%) — Did they explain their vote?
 * 2. Constitutional Article Coverage (30%) — Did they cite relevant articles?
 * 3. Reasoning Quality (30%) — AI-assessed depth of constitutional analysis
 * 4. Consistency & Independence (20%) — Cross-proposal consistency + timeliness
 */

import { logger } from '@/lib/logger';

export interface FidelityPillars {
  rationaleProvision: number; // 0-100
  articleCoverage: number; // 0-100
  reasoningQuality: number; // 0-100
  consistencyIndependence: number; // 0-100
}

export interface FidelityResult {
  score: number; // 0-100 composite
  pillars: FidelityPillars;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

const WEIGHTS = {
  rationaleProvision: 0.2,
  articleCoverage: 0.3,
  reasoningQuality: 0.3,
  consistencyIndependence: 0.2,
};

export function computeFidelityScore(pillars: FidelityPillars): FidelityResult {
  const score = Math.round(
    pillars.rationaleProvision * WEIGHTS.rationaleProvision +
      pillars.articleCoverage * WEIGHTS.articleCoverage +
      pillars.reasoningQuality * WEIGHTS.reasoningQuality +
      pillars.consistencyIndependence * WEIGHTS.consistencyIndependence,
  );

  return { score, pillars, grade: scoreToGrade(score) };
}

function scoreToGrade(score: number): FidelityResult['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Pillar 1: Rationale Provision (0-100)
// ---------------------------------------------------------------------------

export function computeRationaleProvision(totalVotes: number, votesWithRationale: number): number {
  if (totalVotes === 0) return 0;
  return Math.round((votesWithRationale / totalVotes) * 100);
}

// ---------------------------------------------------------------------------
// Pillar 2: Article Coverage (0-100)
// Per-vote score averaged across all votes with rationales.
// ---------------------------------------------------------------------------

/** Expected articles per proposal type (simplified mapping). */
export const EXPECTED_ARTICLES: Record<string, string[]> = {
  TreasuryWithdrawals: ['Article II, § 6', 'Article II, § 7'],
  ParameterChange: ['Article II, § 6', 'Article III'],
  HardForkInitiation: ['Article II, § 6', 'Article III, § 6'],
  InfoAction: ['Article II, § 6'],
  NoConfidence: ['Article II, § 6', 'Article V'],
  NewCommittee: ['Article II, § 6', 'Article V'],
  NewConstitutionalCommittee: ['Article II, § 6', 'Article V'],
  NewConstitution: ['Article II, § 6', 'Article VI'],
  UpdateConstitution: ['Article II, § 6', 'Article VI'],
};

/**
 * Normalize article references to a canonical lowercase form so that
 * "Article II, § 7", "Art. II Section 7", "Art II §7" all match.
 */
export function normalizeArticleRef(ref: string): string {
  return ref
    .replace(/Art\.?/i, 'Article')
    .replace(/Section/i, '§')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Score how well cited articles cover expected articles for a proposal type.
 * Returns 0-100.
 */
export function computeArticleCoverage(proposalType: string, citedArticles: string[]): number {
  const expected = EXPECTED_ARTICLES[proposalType] ?? ['Article II, § 6'];
  if (expected.length === 0) return citedArticles.length > 0 ? 100 : 0;

  const normalizedCited = citedArticles.map(normalizeArticleRef);

  let matched = 0;
  for (const exp of expected) {
    const normalizedExp = normalizeArticleRef(exp);
    const found = normalizedCited.some((cited) => cited.includes(normalizedExp));
    if (found) matched++;
  }

  // Base coverage from expected articles
  const basePct = (matched / expected.length) * 100;

  // Bonus for citing additional articles (up to 15 bonus points)
  const extraCitations = Math.max(0, citedArticles.length - expected.length);
  const bonus = Math.min(15, extraCitations * 5);

  return Math.min(100, Math.round(basePct + bonus));
}

/**
 * Average article coverage across multiple votes.
 */
export function computeAvgArticleCoverage(
  votes: Array<{ proposalType: string; citedArticles: string[] }>,
): number {
  if (votes.length === 0) return 0;
  const total = votes.reduce(
    (sum, v) => sum + computeArticleCoverage(v.proposalType, v.citedArticles),
    0,
  );
  return Math.round(total / votes.length);
}

// ---------------------------------------------------------------------------
// Pillar 3: Reasoning Quality (0-100)
// Per-vote AI score averaged across all votes with rationales.
// AI scoring is done externally and stored; this function averages stored scores.
// ---------------------------------------------------------------------------

export function computeAvgReasoningQuality(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ---------------------------------------------------------------------------
// Pillar 4: Consistency & Independence (0-100)
// Sub-components:
//   - Voting independence (50%): DRep alignment in healthy range (40-70%)
//   - Responsiveness (25%): Time from proposal to CC vote
//   - Cross-type consistency (25%): Similar patterns across proposal types
// ---------------------------------------------------------------------------

/**
 * Independence sub-score (0-100).
 *
 * Composition: 80% vote-direction independence + 20% explanation quality.
 *
 * Vote-direction: Healthy DRep alignment is 40-70%. Pure rubber-stamping
 * (>85%) or pure opposition (<20%) both score low. Perfect score at ~55%.
 *
 * Explanation quality: Rewards CC members who dissent WITH substance.
 * - Dissenting with quality rationale (deliberation_quality >= 60): full points (100)
 * - Dissenting without quality rationale: 50 points
 * - Not dissenting: neutral (50 points — this sub-component rewards quality dissent,
 *   but doesn't penalize agreement)
 */
export function computeIndependenceScore(
  drepAlignmentPct: number,
  options?: { isDissenting?: boolean; deliberationQuality?: number | null },
): number {
  // Vote-direction sub-score (peak at 55%, bell curve)
  const ideal = 55;
  const distance = Math.abs(drepAlignmentPct - ideal);
  let voteDirection: number;
  if (distance <= 15) {
    voteDirection = 100; // 40-70% range = perfect
  } else if (distance <= 30) {
    voteDirection = Math.round(100 - (distance - 15) * 3); // gradual decay
  } else {
    voteDirection = Math.max(0, Math.round(100 - (distance - 15) * 3));
  }

  // Explanation quality sub-score
  let explanationQuality = 50; // Neutral default (not dissenting or no data)
  if (options?.isDissenting) {
    const quality = options.deliberationQuality;
    if (quality != null && quality >= 60) {
      explanationQuality = 100; // Dissenting with substantive reasoning
    } else {
      explanationQuality = 50; // Dissenting without quality rationale
    }
  }

  return Math.round(voteDirection * 0.8 + explanationQuality * 0.2);
}

/**
 * Responsiveness sub-score (0-100).
 * Based on average days from proposal creation to CC vote.
 * Fast response (<3 days) = 100, slow (>14 days) = 30.
 */
export function computeResponsivenessScore(avgDaysToVote: number): number {
  if (avgDaysToVote <= 3) return 100;
  if (avgDaysToVote <= 7) return Math.round(100 - (avgDaysToVote - 3) * 5);
  if (avgDaysToVote <= 14) return Math.round(80 - (avgDaysToVote - 7) * 5);
  return Math.max(20, Math.round(45 - (avgDaysToVote - 14) * 2));
}

/**
 * Cross-type consistency sub-score (0-100).
 * Measures if the CC member votes across all proposal types, not just one.
 */
export function computeTypeConsistencyScore(
  typesVotedOn: number,
  totalActiveTypes: number,
): number {
  if (totalActiveTypes <= 1) return 100;
  return Math.round((typesVotedOn / totalActiveTypes) * 100);
}

/**
 * Combine sub-components into Pillar 4 score.
 */
export function computeConsistencyIndependence(
  drepAlignmentPct: number,
  avgDaysToVote: number,
  typesVotedOn: number,
  totalActiveTypes: number,
  independenceOptions?: { isDissenting?: boolean; deliberationQuality?: number | null },
): number {
  const independence = computeIndependenceScore(drepAlignmentPct, independenceOptions);
  const responsiveness = computeResponsivenessScore(avgDaysToVote);
  const typeConsistency = computeTypeConsistencyScore(typesVotedOn, totalActiveTypes);

  return Math.round(independence * 0.5 + responsiveness * 0.25 + typeConsistency * 0.25);
}

// ---------------------------------------------------------------------------
// Cross-Proposal Pattern Detection
// ---------------------------------------------------------------------------

export interface DriftResult {
  driftDetected: boolean;
  magnitude: number;
}

/**
 * Detect if the current fidelity score deviates significantly from recent history.
 *
 * If the current score deviates by >15 points from the 3-score rolling average,
 * flags as drift. This is a monitoring signal — it does not affect the score.
 */
export function detectVotingDrift(recentScores: number[], currentScore: number): DriftResult {
  if (recentScores.length === 0) {
    return { driftDetected: false, magnitude: 0 };
  }

  // Use up to 3 most recent scores for rolling average
  const windowScores = recentScores.slice(-3);
  const rollingAvg = windowScores.reduce((a, b) => a + b, 0) / windowScores.length;
  const magnitude = Math.abs(currentScore - rollingAvg);
  const driftDetected = magnitude > 15;

  if (driftDetected) {
    logger.info('[fidelityScore] Voting drift detected', {
      currentScore,
      rollingAvg: Math.round(rollingAvg),
      magnitude: Math.round(magnitude),
      windowSize: windowScores.length,
    });
  }

  return { driftDetected, magnitude: Math.round(magnitude) };
}
