/**
 * Score Narrative Context — generates concise, human-readable labels
 * for numeric scores displayed in the DRep profile key facts strip.
 *
 * Maps score ranges + tier + percentile into 1-line contextual descriptions
 * so users understand "what this number means" at a glance.
 */

import { computeTier, type TierName } from './tiers';

interface ScoreNarrativeInput {
  score: number;
  percentile: number;
}

/**
 * Generate a 1-line narrative for the overall governance score.
 * Combines tier name with percentile ranking for immediate context.
 */
export function getScoreNarrative({ score, percentile }: ScoreNarrativeInput): string {
  const tier = computeTier(score);
  const topPct = 100 - percentile;

  const tierDescriptions: Record<TierName, string> = {
    Emerging: 'Early-stage representative',
    Bronze: 'Developing governance track record',
    Silver: 'Solid governance participation',
    Gold: 'Strong governance track record',
    Diamond: 'Exceptional governance quality',
    Legendary: 'Elite governance standard',
  };

  const tierDesc = tierDescriptions[tier];

  if (topPct <= 5 && topPct > 0) return `${tierDesc}, top ${topPct}% of DReps`;
  if (topPct <= 15 && topPct > 0) return `${tierDesc}, top ${topPct}% of DReps`;
  if (topPct <= 30 && topPct > 0) return `${tierDesc}, top ${topPct}%`;
  return tierDesc;
}

/**
 * Generate a 1-line narrative for participation rate.
 */
export function getParticipationNarrative(rate: number): string {
  if (rate >= 90) return 'Votes on nearly every proposal';
  if (rate >= 70) return 'Consistent voter';
  if (rate >= 50) return 'Moderate participation';
  if (rate >= 25) return 'Selective voter';
  if (rate > 0) return 'Limited participation so far';
  return 'No votes recorded yet';
}

/**
 * Generate a 1-line narrative for rationale rate.
 */
export function getRationaleNarrative(rate: number): string {
  if (rate >= 90) return 'Explains nearly every vote';
  if (rate >= 70) return 'Strong transparency';
  if (rate >= 50) return 'Explains most votes';
  if (rate >= 25) return 'Occasionally provides reasoning';
  if (rate > 0) return 'Rarely explains votes';
  return 'No rationales provided yet';
}

/**
 * Generate a 1-line narrative for governance style / identity label.
 */
export function getGovernanceStyleNarrative(identityLabel: string): string {
  // The identity label itself is already descriptive (e.g. "Fiscal Conservative",
  // "Innovation Advocate"), so we add minimal context
  if (identityLabel === 'Balanced' || identityLabel === 'Neutral') {
    return 'No dominant governance philosophy';
  }
  return `Dominant governance philosophy`;
}
