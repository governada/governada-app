/**
 * Match confidence scoring.
 * Confidence increases with the number of overlapping votes between user and DRep.
 * 15 overlapping votes = full confidence.
 */

const FULL_CONFIDENCE_THRESHOLD = 15;

export function calculateMatchConfidence(overlapCount: number): number {
  return Math.min(100, Math.round((overlapCount / FULL_CONFIDENCE_THRESHOLD) * 100));
}
