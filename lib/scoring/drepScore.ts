/**
 * DRep Score V3.1 — Composite calculator + momentum + confidence.
 * Combines 4 absolute-calibrated pillars with configurable weights.
 * Replaces percentile normalization: raw score → calibrated score via
 * piecewise linear curves. Your actions = your score, independent of
 * how other DReps perform.
 *
 * Confidence dampening still applies to calibrated scores for low-data DReps.
 * Momentum is computed from score history via simple linear regression.
 */

import { PILLAR_WEIGHTS, type DRepScoreResult } from './types';
import { dampenPercentile } from './confidence';
import { calibrate, DREP_PILLAR_CALIBRATION } from './calibration';

/**
 * Compute final DRep Scores for all DReps from raw pillar scores.
 * Calibrates each pillar via absolute curves, applies confidence dampening,
 * computes weighted composite, and momentum.
 *
 * @param rawEngagement Map<drepId, raw 0-100>
 * @param rawParticipation Map<drepId, raw 0-100>
 * @param rawReliability Map<drepId, raw 0-100>
 * @param rawIdentity Map<drepId, raw 0-100>
 * @param scoreHistory Map<drepId, recent daily scores> (for momentum)
 * @param confidences Map<drepId, confidence 0-100> (optional — defaults to 100 for backward compat)
 */
export function computeDRepScores(
  rawEngagement: Map<string, number>,
  rawParticipation: Map<string, number>,
  rawReliability: Map<string, number>,
  rawIdentity: Map<string, number>,
  scoreHistory: Map<string, { date: string; score: number }[]>,
  confidences?: Map<string, number>,
): Map<string, DRepScoreResult> {
  const allDrepIds = new Set<string>([
    ...rawEngagement.keys(),
    ...rawParticipation.keys(),
    ...rawReliability.keys(),
    ...rawIdentity.keys(),
  ]);

  const results = new Map<string, DRepScoreResult>();

  for (const drepId of allDrepIds) {
    const confidence = confidences?.get(drepId) ?? 100;

    // Calibrate raw scores via absolute piecewise linear curves
    const eqRaw = rawEngagement.get(drepId) ?? 0;
    const epRaw = rawParticipation.get(drepId) ?? 0;
    const rlRaw = rawReliability.get(drepId) ?? 0;
    const giRaw = rawIdentity.get(drepId) ?? 0;

    let eqCal = dampenPercentile(
      calibrate(eqRaw, DREP_PILLAR_CALIBRATION.engagementQuality),
      confidence,
    );
    let epCal = dampenPercentile(
      calibrate(epRaw, DREP_PILLAR_CALIBRATION.effectiveParticipation),
      confidence,
    );
    let rlCal = dampenPercentile(calibrate(rlRaw, DREP_PILLAR_CALIBRATION.reliability), confidence);
    const giCal = dampenPercentile(
      calibrate(giRaw, DREP_PILLAR_CALIBRATION.governanceIdentity),
      confidence,
    );

    // Zero-activity override: when ALL three activity pillars have raw score 0,
    // the DRep has never participated in governance. Force calibrated scores
    // to 0 instead of the dampened median, so composite reflects actual inactivity.
    // GI (profile-based) is unaffected — it's legitimately earned from profile data.
    if (eqRaw === 0 && epRaw === 0 && rlRaw === 0) {
      eqCal = 0;
      epCal = 0;
      rlCal = 0;
    }

    const composite = Math.round(
      eqCal * PILLAR_WEIGHTS.engagementQuality +
        epCal * PILLAR_WEIGHTS.effectiveParticipation +
        rlCal * PILLAR_WEIGHTS.reliability +
        giCal * PILLAR_WEIGHTS.governanceIdentity,
    );

    const history = scoreHistory.get(drepId);
    const momentum = history ? computeMomentum(history) : null;

    results.set(drepId, {
      composite: clamp(composite),
      engagementQualityRaw: eqRaw,
      engagementQualityCalibrated: eqCal,
      effectiveParticipationRaw: epRaw,
      effectiveParticipationCalibrated: epCal,
      reliabilityRaw: rlRaw,
      reliabilityCalibrated: rlCal,
      governanceIdentityRaw: giRaw,
      governanceIdentityCalibrated: giCal,
      confidence,
      momentum,
    });
  }

  return results;
}

/**
 * Simple linear regression slope from recent score history.
 * Returns points-per-day trend. Positive = improving, negative = declining.
 * Requires at least 2 data points within the last 14 days.
 */
function computeMomentum(history: { date: string; score: number }[]): number | null {
  if (history.length < 2) return null;

  // Use last 14 days of history
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = history.filter((h) => h.date >= cutoffStr);
  if (recent.length < 2) return null;

  // Convert dates to day offsets for regression
  const baseDate = new Date(recent[0].date).getTime();
  const points = recent.map((h) => ({
    x: (new Date(h.date).getTime() - baseDate) / 86400000, // days from base
    y: h.score,
  }));

  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  return Math.round(slope * 100) / 100; // 2 decimal places
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
