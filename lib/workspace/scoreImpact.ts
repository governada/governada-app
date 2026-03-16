/**
 * Score Impact Preview — pure client-side calculation.
 *
 * Estimates how much a DRep/SPO score would improve if they vote on
 * the current proposal, optionally with a rationale.
 *
 * Weight model (simplified from scoring V3):
 *   Engagement Quality:       35%
 *   Effective Participation:  30%
 *   Rationale:                20%
 *   Profile:                  15%
 */

import type { ScoreImpactEstimate } from './types';

interface ScoreImpactParams {
  currentScore?: number;
  totalProposals: number;
  votedCount: number;
}

const WEIGHT_ENGAGEMENT = 0.35;
const WEIGHT_PARTICIPATION = 0.3;
const WEIGHT_RATIONALE = 0.2;
// Profile weight (0.15) is included for reference but not used in this calculation
// since profile completeness doesn't change with a single vote.

/**
 * Estimate the score impact of casting one more vote (and optionally adding a rationale).
 */
export function estimateScoreImpact(params: ScoreImpactParams): ScoreImpactEstimate {
  const { totalProposals, votedCount } = params;

  // Avoid division by zero
  const effectiveTotal = Math.max(totalProposals, 1);

  const currentParticipationRate = votedCount / effectiveTotal;
  const projectedParticipationRate = (votedCount + 1) / effectiveTotal;
  const participationDelta = projectedParticipationRate - currentParticipationRate;

  // Participation pillar improvement (scaled to 100)
  const participationGain = participationDelta * 100 * WEIGHT_PARTICIPATION;

  // Engagement quality improvement from casting a vote (small bump)
  const engagementGain = (1 / effectiveTotal) * 100 * WEIGHT_ENGAGEMENT * 0.5;

  // Rationale bonus: if the voter includes a rationale, the rationale pillar improves
  const currentRationaleRate = votedCount > 0 ? 0.5 : 0; // Assume ~50% have rationales
  const projectedRationaleRate = (votedCount * currentRationaleRate + 1) / (votedCount + 1);
  const rationaleBoost =
    (projectedRationaleRate - currentRationaleRate) * 100 * WEIGHT_RATIONALE * 0.3;

  // Total score gain (clamped to reasonable range)
  const estimatedScoreGain = Math.max(0, Math.min(10, participationGain + engagementGain));

  return {
    currentParticipationRate: Math.round(currentParticipationRate * 1000) / 10,
    projectedParticipationRate: Math.round(projectedParticipationRate * 1000) / 10,
    participationDelta: Math.round(participationDelta * 1000) / 10,
    rationaleBoost: Math.round(rationaleBoost * 10) / 10,
    estimatedScoreGain: Math.round((estimatedScoreGain + rationaleBoost) * 10) / 10,
  };
}
