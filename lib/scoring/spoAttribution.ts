/**
 * Per-vote attribution engine for SPO Score V3.
 * Decomposes each pillar score into specific vote-level contributions,
 * producing actionable explanations like "Your reliability dropped 8 points
 * due to a 4-epoch gap in epochs 482-486."
 */

import { DECAY_LAMBDA } from './types';
import type { SpoVoteDataV3 } from './spoScore';

export interface AttributionEntry {
  proposalKey: string | null;
  type: string | null;
  contribution: number;
  reason: string;
}

export interface PillarAttribution {
  score: number;
  percentile: number;
  topContributors: AttributionEntry[];
  topDetractors: AttributionEntry[];
}

export interface SpoAttribution {
  poolId: string;
  epoch: number;
  confidence: number;
  pillars: {
    participation: PillarAttribution;
    deliberation: PillarAttribution;
    reliability: PillarAttribution;
    identity: PillarAttribution;
  };
  recommendations: string[];
}

/**
 * Compute per-vote attribution for participation pillar.
 * Returns marginal contribution of each vote to the raw score.
 */
export function computeParticipationAttribution(
  votes: SpoVoteDataV3[],
  totalProposalPool: number,
  nowSeconds: number,
  proposalMarginMultipliers: Map<string, number>,
): { contributions: AttributionEntry[] } {
  if (totalProposalPool === 0) return { contributions: [] };

  const contributions: AttributionEntry[] = [];
  const seen = new Set<string>();

  for (const v of votes) {
    if (seen.has(v.proposalKey)) continue;
    seen.add(v.proposalKey);

    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const marginMult = proposalMarginMultipliers.get(v.proposalKey) ?? 1;
    const weight = v.importanceWeight * decay * marginMult;
    const contribution = (weight / totalProposalPool) * 100;

    const parts: string[] = [];
    if (v.importanceWeight >= 3) parts.push('Critical proposal');
    else if (v.importanceWeight >= 2) parts.push('Important proposal');
    if (marginMult > 1) parts.push('contentious vote');
    if (decay < 0.5) parts.push('older vote (decayed)');

    contributions.push({
      proposalKey: v.proposalKey,
      type: v.proposalType,
      contribution: Math.round(contribution * 10) / 10,
      reason: parts.length > 0 ? parts.join(', ') : 'Standard vote',
    });
  }

  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return { contributions };
}

/**
 * Generate actionable recommendations based on pillar scores.
 */
export function generateRecommendations(
  participationPct: number,
  deliberationPct: number,
  reliabilityPct: number,
  identityPct: number,
  hasRationale: boolean,
  hasGovernanceStatement: boolean,
  hasSocialLinks: boolean,
): string[] {
  const recommendations: string[] = [];

  // Find weakest pillar (weighted by impact)
  const pillars = [
    { name: 'participation', score: participationPct, weight: 0.35 },
    { name: 'deliberation', score: deliberationPct, weight: 0.25 },
    { name: 'reliability', score: reliabilityPct, weight: 0.25 },
    { name: 'identity', score: identityPct, weight: 0.15 },
  ].sort((a, b) => a.score * a.weight - b.score * b.weight);

  const weakest = pillars[0];

  if (weakest.name === 'participation' || participationPct < 40) {
    recommendations.push('Vote on open governance proposals to improve your Participation score');
  }
  if (weakest.name === 'deliberation' || deliberationPct < 40) {
    if (!hasRationale) {
      recommendations.push(
        'Provide rationales when voting to unlock the Deliberation Quality pillar',
      );
    } else {
      recommendations.push('Vote across different proposal types to improve your coverage entropy');
    }
  }
  if (weakest.name === 'reliability' || reliabilityPct < 40) {
    recommendations.push('Vote consistently every epoch to build your reliability streak');
  }
  if (weakest.name === 'identity' || identityPct < 40) {
    if (!hasGovernanceStatement) {
      recommendations.push('Add a governance statement to your pool profile (+15 identity points)');
    }
    if (!hasSocialLinks) {
      recommendations.push('Add social media links to your profile (+30 identity points)');
    }
  }

  return recommendations.slice(0, 3);
}
