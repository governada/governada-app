/**
 * Per-vote attribution engine for SPO Score V3.2.
 * Decomposes each pillar score into specific vote-level contributions,
 * producing actionable explanations like "Your reliability dropped 8 points
 * due to a 4-epoch gap in epochs 482-486."
 */

import { DECAY_LAMBDA } from './types';
import { SPO_ABSTAIN_PENALTY } from './calibration';
import type { SpoVoteDataV3 } from './spoScore';
import type { SpoDeliberationVoteData } from './spoDeliberationQuality';

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
  sybilFlagged?: boolean;
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

// ---------------------------------------------------------------------------
// Deliberation Attribution
// ---------------------------------------------------------------------------

/**
 * Break down the V3.2 deliberation quality sub-components into
 * human-readable attribution entries.
 */
export function computeDeliberationAttribution(
  votes: SpoDeliberationVoteData[],
  allProposalTypes: Set<string>,
): { contributions: AttributionEntry[] } {
  const contributions: AttributionEntry[] = [];

  if (votes.length === 0) {
    contributions.push({
      proposalKey: null,
      type: null,
      contribution: 0,
      reason: 'No votes cast — deliberation quality cannot be measured',
    });
    return { contributions };
  }

  // --- Vote Diversity ---
  let yesCount = 0;
  let noCount = 0;
  let abstainCount = 0;
  for (const v of votes) {
    if (v.vote === 'Yes') yesCount++;
    else if (v.vote === 'No') noCount++;
    else abstainCount++;
  }
  const total = votes.length;
  const abstainRate = abstainCount / total;
  const nonAbstain = yesCount + noCount;
  const dominantDir = yesCount >= noCount ? 'Yes' : 'No';
  const dominantPct =
    nonAbstain > 0 ? Math.round((Math.max(yesCount, noCount) / nonAbstain) * 100) : 0;
  const abstainPenaltyApplied = abstainRate > SPO_ABSTAIN_PENALTY.threshold;

  contributions.push({
    proposalKey: null,
    type: null,
    contribution: dominantPct <= 85 ? 10 : -10,
    reason:
      nonAbstain === 0
        ? 'Vote Diversity: All votes are Abstain — no directional diversity'
        : `Vote Diversity: ${dominantPct}% ${dominantDir} among non-abstain votes` +
          (dominantPct > 85 ? ' (rubber-stamp penalty applied)' : ' (healthy mix)') +
          (abstainPenaltyApplied
            ? `. Abstain penalty active (${Math.round(abstainRate * 100)}% abstain rate > ${Math.round(SPO_ABSTAIN_PENALTY.threshold * 100)}% threshold)`
            : ''),
  });

  // --- Dissent Rate ---
  const eligibleVotes = votes.filter((v) => v.spoMajorityVote != null && v.vote !== 'Abstain');
  let dissentCount = 0;
  for (const v of eligibleVotes) {
    if (v.vote !== v.spoMajorityVote) dissentCount++;
  }
  const dissentPct =
    eligibleVotes.length > 0 ? Math.round((dissentCount / eligibleVotes.length) * 100) : 0;
  const inSweetSpot = dissentPct >= 15 && dissentPct <= 40;

  contributions.push({
    proposalKey: null,
    type: null,
    contribution: inSweetSpot ? 10 : dissentPct === 0 ? -10 : 0,
    reason:
      eligibleVotes.length < 3
        ? `Dissent Rate: Insufficient majority data (${eligibleVotes.length} eligible votes, need 3) — neutral score applied`
        : `Dissent Rate: ${dissentPct}% of votes against SPO majority` +
          (inSweetSpot
            ? ' (in 15-40% sweet spot — full score)'
            : dissentPct < 15
              ? ' (below 15% — consider voting independently more often)'
              : ' (above 40% — high contrarian rate reduces score)'),
  });

  // --- Type Breadth ---
  const votedTypes = new Set<string>();
  for (const v of votes) votedTypes.add(v.proposalType);
  const coveredTypes = [...votedTypes];
  const missingTypes = [...allProposalTypes].filter((t) => !votedTypes.has(t));

  contributions.push({
    proposalKey: null,
    type: null,
    contribution: missingTypes.length === 0 ? 10 : -Math.min(10, missingTypes.length * 3),
    reason:
      `Type Breadth: Voted on ${coveredTypes.length}/${allProposalTypes.size} proposal types` +
      (coveredTypes.length > 0 ? ` (${coveredTypes.join(', ')})` : '') +
      (missingTypes.length > 0 ? `. Missing: ${missingTypes.join(', ')}` : ' — full coverage'),
  });

  // --- Coverage Entropy ---
  const typeCounts = new Map<string, number>();
  for (const v of votes) {
    typeCounts.set(v.proposalType, (typeCounts.get(v.proposalType) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of typeCounts.values()) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = allProposalTypes.size > 1 ? Math.log2(allProposalTypes.size) : 1;
  const entropyNormalized = Math.round((entropy / maxEntropy) * 100);

  // Find the type that would most improve entropy if voted on more
  let bestImprovementType: string | null = null;
  if (missingTypes.length > 0) {
    bestImprovementType = missingTypes[0];
  } else {
    // Find least-represented type
    let minCount = Infinity;
    for (const [t, c] of typeCounts) {
      if (c < minCount) {
        minCount = c;
        bestImprovementType = t;
      }
    }
  }

  contributions.push({
    proposalKey: null,
    type: null,
    contribution: entropyNormalized >= 70 ? 5 : -5,
    reason:
      `Coverage Entropy: ${entropyNormalized}/100 (${entropyNormalized >= 70 ? 'well-balanced' : 'uneven'} distribution across types)` +
      (bestImprovementType
        ? `. Voting on more ${bestImprovementType} proposals would improve balance`
        : ''),
  });

  return { contributions };
}

// ---------------------------------------------------------------------------
// Identity Attribution
// ---------------------------------------------------------------------------

export interface IdentityFields {
  hasGovernanceStatement: boolean;
  governanceStatementLength: number;
  socialLinkCount: number;
  communityScore: number;
  voteCount: number;
}

/**
 * Report which identity fields contribute points and which are
 * gated behind vote count thresholds.
 */
export function computeIdentityAttribution(fields: IdentityFields): {
  contributions: AttributionEntry[];
} {
  const contributions: AttributionEntry[] = [];
  const {
    hasGovernanceStatement,
    governanceStatementLength,
    socialLinkCount,
    communityScore,
    voteCount,
  } = fields;

  // Governance statement presence: +5 pts, requires 1+ votes
  if (hasGovernanceStatement && voteCount >= 1) {
    contributions.push({
      proposalKey: null,
      type: null,
      contribution: 5,
      reason: 'Governance statement present: +5 pts (requires 1+ votes)',
    });
  } else if (hasGovernanceStatement && voteCount === 0) {
    contributions.push({
      proposalKey: null,
      type: null,
      contribution: 0,
      reason: 'Governance statement: 0 pts (no votes cast — gated behind 1+ votes)',
    });
  } else {
    contributions.push({
      proposalKey: null,
      type: null,
      contribution: 0,
      reason: 'Governance statement: not set (0 pts)',
    });
  }

  // Statement length >100 chars: +5 pts, requires 3+ votes
  if (hasGovernanceStatement && governanceStatementLength > 100 && voteCount >= 3) {
    contributions.push({
      proposalKey: null,
      type: null,
      contribution: 5,
      reason: `Statement length ${governanceStatementLength} chars (>100): +5 pts (requires 3+ votes)`,
    });
  } else if (hasGovernanceStatement && governanceStatementLength > 100 && voteCount < 3) {
    contributions.push({
      proposalKey: null,
      type: null,
      contribution: 0,
      reason: `Statement length ${governanceStatementLength} chars (>100): 0 pts (need ${3 - voteCount} more votes to unlock)`,
    });
  } else if (hasGovernanceStatement) {
    contributions.push({
      proposalKey: null,
      type: null,
      contribution: 0,
      reason: `Statement length ${governanceStatementLength} chars (≤100): expand to >100 chars for +5 pts`,
    });
  }

  // Social links
  contributions.push({
    proposalKey: null,
    type: null,
    contribution: Math.min(socialLinkCount, 3) * 10,
    reason:
      socialLinkCount > 0
        ? `Social links (${socialLinkCount} valid): +${Math.min(socialLinkCount, 3) * 10} pts`
        : 'Social links: none set (0 pts — add up to 3 for +30 pts)',
  });

  // Community score
  contributions.push({
    proposalKey: null,
    type: null,
    contribution: communityScore,
    reason:
      communityScore > 50
        ? `Community score: ${communityScore} (above neutral — strong delegation retention)`
        : communityScore < 50
          ? `Community score: ${communityScore} (below neutral — delegation retention declining)`
          : `Community score: ${communityScore} (neutral — delegation retention data insufficient)`,
  });

  return { contributions };
}

// ---------------------------------------------------------------------------
// Recommendations (V3.2)
// ---------------------------------------------------------------------------

/**
 * Generate actionable recommendations based on pillar scores.
 *
 * V3.2: Replaces rationale-based recommendations with voting behavior signals.
 * New params are optional for backward compatibility.
 */
export function generateRecommendations(
  participationPct: number,
  deliberationPct: number,
  reliabilityPct: number,
  identityPct: number,
  hasRationale: boolean,
  hasGovernanceStatement: boolean,
  hasSocialLinks: boolean,
  voteDiversityPct: number = 50,
  dissentPct: number = 20,
  abstainRate: number = 0,
  voteCount: number = 10,
  hasSybilFlag: boolean = false,
): string[] {
  const recommendations: string[] = [];

  // Sybil flag — always top priority
  if (hasSybilFlag) {
    recommendations.push(
      'Your pool has been flagged for high vote correlation with another pool. This reduces your score confidence.',
    );
  }

  // Find weakest pillar (weighted by impact)
  const pillars = [
    { name: 'participation', score: participationPct, weight: 0.35 },
    { name: 'deliberation', score: deliberationPct, weight: 0.25 },
    { name: 'reliability', score: reliabilityPct, weight: 0.25 },
    { name: 'identity', score: identityPct, weight: 0.15 },
  ].sort((a, b) => a.score * a.weight - b.score * b.weight);

  const weakest = pillars[0];

  // Participation
  if (weakest.name === 'participation' || participationPct < 40) {
    recommendations.push('Vote on open governance proposals to improve your Participation score');
  }

  // Deliberation — V3.2 behavior-based recommendations
  if (weakest.name === 'deliberation' || deliberationPct < 40) {
    if (voteDiversityPct > 85) {
      recommendations.push(
        'Consider varying your votes — voting the same direction on every proposal reduces your Deliberation Quality score',
      );
    }
    if (dissentPct === 0) {
      recommendations.push(
        'Independent judgment is valued — voting against the majority when you disagree demonstrates governance maturity',
      );
    }
    if (abstainRate > 0.6) {
      recommendations.push(
        'Taking positions strengthens your score — abstaining on most votes signals disengagement',
      );
    }
    // Fallback if none of the specific deliberation issues apply
    if (voteDiversityPct <= 85 && dissentPct > 0 && abstainRate <= 0.6) {
      recommendations.push('Vote across different proposal types to improve your coverage entropy');
    }
  }

  // Reliability
  if (weakest.name === 'reliability' || reliabilityPct < 40) {
    recommendations.push('Vote consistently every epoch to build your reliability streak');
  }

  // Identity
  if (weakest.name === 'identity' || identityPct < 40) {
    if (!hasGovernanceStatement && voteCount < 1) {
      recommendations.push(
        'Add a governance statement AND start voting — identity points are gated behind voting activity',
      );
    } else if (!hasGovernanceStatement) {
      recommendations.push('Add a governance statement to your pool profile (+15 identity points)');
    }
    if (!hasSocialLinks) {
      recommendations.push('Add social media links to your profile (+30 identity points)');
    }
  }

  return recommendations.slice(0, 3);
}
