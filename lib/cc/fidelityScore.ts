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
 * Score how well cited articles cover expected articles for a proposal type.
 * Returns 0-100.
 */
export function computeArticleCoverage(proposalType: string, citedArticles: string[]): number {
  const expected = EXPECTED_ARTICLES[proposalType] ?? ['Article II, § 6'];
  if (expected.length === 0) return citedArticles.length > 0 ? 100 : 0;

  let matched = 0;
  for (const exp of expected) {
    // Fuzzy match: "Article II, § 7" matches citations containing "Article II" and "7"
    const parts = exp.split(/[,§\s]+/).filter(Boolean);
    const found = citedArticles.some((cited) => parts.every((part) => cited.includes(part)));
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
 * Healthy DRep alignment is 40-70%. Pure rubber-stamping (>85%) or pure
 * opposition (<20%) both score low. Perfect score at ~55%.
 */
export function computeIndependenceScore(drepAlignmentPct: number): number {
  // Peak at 55%, with a bell curve shape
  const ideal = 55;
  const distance = Math.abs(drepAlignmentPct - ideal);

  if (distance <= 15) return 100; // 40-70% range = perfect
  if (distance <= 30) return Math.round(100 - (distance - 15) * 3); // gradual decay
  return Math.max(0, Math.round(100 - (distance - 15) * 3));
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
): number {
  const independence = computeIndependenceScore(drepAlignmentPct);
  const responsiveness = computeResponsivenessScore(avgDaysToVote);
  const typeConsistency = computeTypeConsistencyScore(typesVotedOn, totalActiveTypes);

  return Math.round(independence * 0.5 + responsiveness * 0.25 + typeConsistency * 0.25);
}
