/**
 * Score Confidence System for SPO Score V3 and DRep Score V3.
 * Measures how reliable an entity's score is based on available evidence.
 *
 * Effects:
 * - Confidence caps tier via graduated vote-count thresholds (DReps and SPOs)
 * - Low-confidence entities contribute less to percentile distribution
 * - Confidence dampening pulls low-data percentile scores toward the median
 * - UI renders low-confidence scores with a "provisional" marker
 */

import { SPO_CONFIDENCE, DREP_CONFIDENCE } from './calibration';
import type { TierName } from './tiers';

// ---------------------------------------------------------------------------
// SPO Confidence (original)
// ---------------------------------------------------------------------------

/**
 * Compute confidence (0-100) for a single SPO based on evidence volume.
 *
 * - voteCount: primary signal (~15 votes = 80% confidence)
 * - epochSpan: how many epochs between first and last vote
 * - typeCoverage: fraction of proposal types voted on (0-1)
 */
export function computeConfidence(
  voteCount: number,
  epochSpan: number,
  typeCoverage: number,
): number {
  const voteFactor = 1 - Math.exp(-voteCount / SPO_CONFIDENCE.voteDecayRate);
  const spanFactor = 1 - Math.exp(-epochSpan / SPO_CONFIDENCE.spanDecayRate);
  const typeFactor = Math.min(1, typeCoverage / SPO_CONFIDENCE.typeCoverageThreshold);

  return Math.round(
    (voteFactor * SPO_CONFIDENCE.weights.vote +
      spanFactor * SPO_CONFIDENCE.weights.span +
      typeFactor * SPO_CONFIDENCE.weights.type) *
      100,
  );
}

// ---------------------------------------------------------------------------
// DRep Confidence
// ---------------------------------------------------------------------------

/**
 * Compute confidence (0-100) for a single DRep based on evidence volume.
 * Mirrors the SPO confidence formula but uses DRep-specific calibration.
 *
 * @param voteCount Number of votes cast
 * @param epochSpan Number of epochs between first and last vote
 * @param typeCoverage Fraction of proposal types voted on (0-1)
 */
export function computeDRepConfidence(
  voteCount: number,
  epochSpan: number,
  typeCoverage: number,
): number {
  const voteFactor = 1 - Math.exp(-voteCount / DREP_CONFIDENCE.voteDecayRate);
  const spanFactor = 1 - Math.exp(-epochSpan / DREP_CONFIDENCE.spanDecayRate);
  const typeFactor = Math.min(1, typeCoverage / DREP_CONFIDENCE.typeCoverageThreshold);

  return Math.round(
    (voteFactor * DREP_CONFIDENCE.weights.vote +
      spanFactor * DREP_CONFIDENCE.weights.span +
      typeFactor * DREP_CONFIDENCE.weights.type) *
      100,
  );
}

/**
 * Get the maximum tier allowed for a DRep based on their vote count.
 * Uses graduated thresholds from DREP_CONFIDENCE.tierCaps.
 *
 * Returns null if no cap applies (full confidence).
 */
export function getDRepTierCap(voteCount: number): TierName | null {
  for (const cap of DREP_CONFIDENCE.tierCaps) {
    if (voteCount < cap.maxVotes) return cap.maxTier;
  }
  return null; // No cap for 15+ votes
}

/**
 * Get DRep confidence level based on vote count (graduated).
 * This is a simpler alternative to the full computeDRepConfidence() formula
 * that only uses vote count, for tier cap decisions.
 */
export function getDRepConfidenceByVotes(voteCount: number): number {
  for (const cap of DREP_CONFIDENCE.tierCaps) {
    if (voteCount < cap.maxVotes) return cap.confidence;
  }
  return DREP_CONFIDENCE.fullConfidence;
}

/**
 * Dampen a percentile score toward the median based on confidence.
 * Low-confidence entities are pulled toward 50 (median), preventing
 * skewed raw score distributions from inflating percentile ranks.
 *
 * Formula: adjustedScore = median + (rawPercentile - median) * (confidence / 100)
 *
 * Examples:
 * - 100% confidence: score unchanged
 * - 50% confidence: score halfway between raw and 50
 * - 0% confidence: score = 50 (median)
 */
export function dampenPercentile(rawPercentile: number, confidence: number): number {
  const median = 50;
  const normalizedConfidence = Math.max(0, Math.min(100, confidence)) / 100;
  return Math.round(median + (rawPercentile - median) * normalizedConfidence);
}

// ---------------------------------------------------------------------------
// Shared: Confidence dampening for pillar scores
// ---------------------------------------------------------------------------

/**
 * Dampen a calibrated pillar score toward neutral based on confidence.
 * Low-confidence entities get scores pulled toward 50 (neutral).
 * High-confidence entities keep their actual scores.
 *
 * This ensures a 2-vote DRep (50% confidence) gets pillar scores pulled
 * halfway toward 50, preventing low-data entities from appearing falsely
 * strong or weak. Applied after calibration, before composite computation.
 *
 * Formula: dampened = 50 + (calibratedScore - 50) * (confidence / 100)
 *
 * Examples:
 * - 100% confidence, score 80 → 80 (unchanged)
 * - 50% confidence, score 80 → 65 (pulled toward neutral)
 * - 50% confidence, score 20 → 35 (pulled toward neutral)
 * - 0% confidence, score anything → 50 (fully neutral)
 *
 * NOT applied to CC Fidelity (only 7 members, confidence N/A) or GHI (ecosystem metric).
 */
export function dampenPillarScore(calibratedScore: number, confidence: number): number {
  const confidenceFactor = Math.max(0, Math.min(100, confidence)) / 100;
  return Math.round(50 + (calibratedScore - 50) * confidenceFactor);
}

// ---------------------------------------------------------------------------
// Shared: Confidence-weighted percentile normalization
// ---------------------------------------------------------------------------

/**
 * Confidence-weighted percentile normalization.
 * Low-confidence entries contribute less to the distribution,
 * preventing 2-vote SPOs from distorting rankings for 200-vote SPOs.
 *
 * Algorithm:
 * 1. Weight each entry's "count" in the ranking by its confidence
 * 2. Compute weighted percentile ranks
 */
export function percentileNormalizeWeighted(
  rawScores: Map<string, number>,
  confidences: Map<string, number>,
): Map<string, number> {
  const entries = [...rawScores.entries()];
  const n = entries.length;

  if (n === 0) return new Map();
  if (n === 1) return new Map([[entries[0][0], 50]]);

  const sorted = entries
    .map(([id, value]) => ({
      id,
      value,
      weight: Math.max(0.1, (confidences.get(id) ?? 50) / 100),
    }))
    .sort((a, b) => a.value - b.value);

  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
  const percentiles = new Map<string, number>();

  let cumulativeWeight = 0;
  let i = 0;

  while (i < sorted.length) {
    let j = i;
    let tieWeight = 0;

    // Find all entries with the same value (ties)
    while (j < sorted.length && sorted[j].value === sorted[i].value) {
      tieWeight += sorted[j].weight;
      j++;
    }

    // Percentile = midpoint of the cumulative weight range for this tie group
    const midCumulative = cumulativeWeight + tieWeight / 2;
    const percentile = Math.round((midCumulative / totalWeight) * 100);

    for (let k = i; k < j; k++) {
      percentiles.set(sorted[k].id, Math.min(100, percentile));
    }

    cumulativeWeight += tieWeight;
    i = j;
  }

  return percentiles;
}

// ---------------------------------------------------------------------------
// SPO Graduated Confidence (V3.2)
// ---------------------------------------------------------------------------

/**
 * Get the maximum tier allowed for an SPO based on their vote count.
 * Uses graduated thresholds from SPO_CONFIDENCE.tierCaps.
 *
 * Returns null if no cap applies (full confidence).
 */
export function getSpoTierCap(voteCount: number): TierName | null {
  for (const cap of SPO_CONFIDENCE.tierCaps) {
    if (voteCount < cap.maxVotes) return cap.maxTier;
  }
  return null; // No cap for fullConfidenceVotes+
}

/**
 * Get SPO confidence level based on vote count (graduated).
 * Simpler alternative to computeConfidence() for tier cap decisions.
 */
export function getSpoConfidenceByVotes(voteCount: number): number {
  for (const cap of SPO_CONFIDENCE.tierCaps) {
    if (voteCount < cap.maxVotes) return cap.confidence;
  }
  return SPO_CONFIDENCE.fullConfidence;
}
