/**
 * Per-proposal alignment engine (WS-1).
 *
 * Pure computation module: takes a user's alignment profile and a DRep's
 * votes (enriched with proposal classifications), then produces
 * per-proposal agreement/disagreement results plus an aggregate summary.
 *
 * No database access in core functions -- data fetching is the caller's
 * responsibility (e.g. the alignment API route).
 */

import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import {
  computeDimensionAgreement,
  DIMENSIONS,
  DIMENSION_LABELS,
  type DimensionAgreementResult,
} from './dimensionAgreement';
import { generateMatchNarrative } from './matchNarrative';

/* ─── Constants ───────────────────────────────────────── */

/** Minimum classification score (0-1) for a proposal to qualify. */
const MIN_CLASSIFICATION_SCORE = 0.6;

/** Decay factor per epoch for recency weighting. */
const RECENCY_DECAY = 0.1;

/* ─── Types ───────────────────────────────────────────── */

/** Per-proposal classification scores (0-1 scale, matching proposal_classifications table). */
export interface VoteClassification {
  dimTreasuryConservative: number;
  dimTreasuryGrowth: number;
  dimDecentralization: number;
  dimSecurity: number;
  dimInnovation: number;
  dimTransparency: number;
}

/** A DRep vote enriched with proposal metadata and classification data. */
export interface VoteWithClassification {
  proposalId: string;
  proposalTitle: string;
  proposalType: string;
  vote: 'Yes' | 'No' | 'Abstain';
  epochNo: number;
  classification: VoteClassification;
}

export interface ProposalAlignmentResult {
  proposalId: string;
  proposalTitle: string;
  proposalType: string;
  drepVote: 'Yes' | 'No' | 'Abstain';
  predictedUserStance: 'Yes' | 'No' | 'Neutral';
  stanceConfidence: number;
  agreement: 'agree' | 'disagree' | 'neutral';
  reason: string;
  dimension: string;
}

export interface AlignmentSummary {
  overallAlignment: number | null;
  confidence: number;
  confidenceLabel: string;
  topAgreements: ProposalAlignmentResult[];
  topDisagreements: ProposalAlignmentResult[];
  dimensionBreakdown: DimensionAgreementResult;
  narrative: string;
}

interface StancePrediction {
  stance: 'Yes' | 'No' | 'Neutral';
  confidence: number;
}

/* ─── Helpers ─────────────────────────────────────────── */

/** Map from classification field to AlignmentDimension key. */
const CLASSIFICATION_TO_DIMENSION: Record<string, AlignmentDimension> = {
  dimTreasuryConservative: 'treasuryConservative',
  dimTreasuryGrowth: 'treasuryGrowth',
  dimDecentralization: 'decentralization',
  dimSecurity: 'security',
  dimInnovation: 'innovation',
  dimTransparency: 'transparency',
};

/**
 * Find the primary dimension for a proposal classification.
 * Returns the dimension with the highest score >= MIN_CLASSIFICATION_SCORE,
 * or null if none qualify. Ties broken by DIMENSIONS order.
 */
function findPrimaryDimension(classification: VoteClassification): AlignmentDimension | null {
  let bestDim: AlignmentDimension | null = null;
  let bestScore = -1;

  const entries: [string, number][] = [
    ['dimTreasuryConservative', classification.dimTreasuryConservative],
    ['dimTreasuryGrowth', classification.dimTreasuryGrowth],
    ['dimDecentralization', classification.dimDecentralization],
    ['dimSecurity', classification.dimSecurity],
    ['dimInnovation', classification.dimInnovation],
    ['dimTransparency', classification.dimTransparency],
  ];

  for (const [field, score] of entries) {
    if (score < MIN_CLASSIFICATION_SCORE) continue;
    const dim = CLASSIFICATION_TO_DIMENSION[field];
    if (!dim) continue;

    if (score > bestScore) {
      bestScore = score;
      bestDim = dim;
    } else if (score === bestScore && bestDim !== null) {
      // Tie-break: use DIMENSIONS order (lower index wins)
      const currentIdx = DIMENSIONS.indexOf(dim);
      const bestIdx = DIMENSIONS.indexOf(bestDim);
      if (currentIdx < bestIdx) {
        bestDim = dim;
      }
    }
  }

  return bestDim;
}

/* ─── Core Functions ──────────────────────────────────── */

/**
 * Predict a user's likely stance on a proposal given their alignment score
 * on the relevant dimension and the proposal's classification score.
 *
 * @param userScore - User's alignment on the primary dimension (0-100, null defaults to 50)
 * @param proposalDimensionScore - Proposal's classification score on that dimension (0-1)
 * @returns Predicted stance and confidence level
 */
export function predictUserStance(
  userScore: number | null,
  proposalDimensionScore: number,
): StancePrediction {
  const score = userScore ?? 50;

  // Only predict when the proposal is relevant enough
  if (proposalDimensionScore < MIN_CLASSIFICATION_SCORE) {
    return { stance: 'Neutral', confidence: 0 };
  }

  const confidence = Math.abs(score - 50) * 2; // 0 at 50, 100 at 0 or 100

  if (score > 65) {
    return { stance: 'Yes', confidence };
  }
  if (score < 35) {
    return { stance: 'No', confidence };
  }

  return { stance: 'Neutral', confidence };
}

/**
 * Determine agreement between predicted user stance and DRep's actual vote.
 */
function classifyAgreement(
  predicted: 'Yes' | 'No' | 'Neutral',
  drepVote: 'Yes' | 'No' | 'Abstain',
): 'agree' | 'disagree' | 'neutral' {
  // DRep Abstain is always neutral
  if (drepVote === 'Abstain') return 'neutral';
  // User Neutral is always neutral
  if (predicted === 'Neutral') return 'neutral';
  // Same direction = agree, opposite = disagree
  if (predicted === drepVote) return 'agree';
  return 'disagree';
}

/**
 * Template-based reason strings for proposal alignment cards.
 *
 * @param dimension - The alignment dimension label (e.g. "Treasury Conservative")
 * @param agreement - Whether user and DRep agree or disagree
 * @returns Human-readable reason string
 */
export function getProposalAlignmentReason(
  dimension: string,
  agreement: 'agree' | 'disagree',
): string {
  const reasons: Record<string, Record<'agree' | 'disagree', string>> = {
    'Treasury Conservative': {
      agree: 'You both prioritize fiscal conservatism',
      disagree: 'You differ on treasury spending caution',
    },
    'Treasury Growth': {
      agree: 'You both support growth investment',
      disagree: 'You differ on treasury growth strategy',
    },
    Decentralization: {
      agree: 'You both value decentralization',
      disagree: 'You differ on power distribution',
    },
    Security: {
      agree: 'You both prioritize protocol security',
      disagree: 'You differ on security priorities',
    },
    Innovation: {
      agree: 'You both support innovation',
      disagree: 'You differ on innovation priorities',
    },
    Transparency: {
      agree: 'You both value transparency',
      disagree: 'You differ on transparency expectations',
    },
  };

  return (
    reasons[dimension]?.[agreement] ??
    `${agreement === 'agree' ? 'Aligned' : 'Differ'} on ${dimension}`
  );
}

/**
 * Compute per-proposal alignment between a user and a DRep.
 *
 * Pure computation -- no database access. The caller provides all data.
 *
 * @param userAlignment - User's alignment scores (0-100 per dimension)
 * @param drepVotes - DRep's votes enriched with proposal classifications
 * @param options - Optional limits for top agreements/disagreements
 * @param currentEpoch - Current epoch number (for recency weighting)
 * @returns AlignmentSummary or null if no computable alignment
 */
export function computeProposalAlignment(
  userAlignment: AlignmentScores,
  drepVotes: VoteWithClassification[],
  options?: { maxAgreements?: number; maxDisagreements?: number },
  currentEpoch?: number,
): AlignmentSummary | null {
  const maxAgreements = options?.maxAgreements ?? 3;
  const maxDisagreements = options?.maxDisagreements ?? 2;

  if (drepVotes.length === 0) return null;

  // Process each vote: find primary dimension, predict stance, classify agreement
  const processed: (ProposalAlignmentResult & {
    score: number;
    dimKey: AlignmentDimension;
  })[] = [];

  const latestEpoch = currentEpoch ?? Math.max(...drepVotes.map((v) => v.epochNo));

  for (const vote of drepVotes) {
    const primaryDim = findPrimaryDimension(vote.classification);
    if (!primaryDim) continue; // Skip proposals without a qualifying dimension

    const userScore = userAlignment[primaryDim];
    const classificationField =
      `dim${primaryDim.charAt(0).toUpperCase()}${primaryDim.slice(1)}` as keyof VoteClassification;
    const proposalDimScore = vote.classification[classificationField];

    const prediction = predictUserStance(userScore, proposalDimScore);
    const agreement = classifyAgreement(prediction.stance, vote.vote);
    const dimLabel = DIMENSION_LABELS[primaryDim];

    const epochsAgo = Math.max(0, latestEpoch - vote.epochNo);
    const recencyWeight = 1 / (1 + epochsAgo * RECENCY_DECAY);
    const rankScore = prediction.confidence * recencyWeight;

    const reason =
      agreement === 'neutral'
        ? vote.vote === 'Abstain'
          ? 'DRep abstained on this proposal'
          : 'Insufficient alignment signal on this dimension'
        : getProposalAlignmentReason(dimLabel, agreement);

    processed.push({
      proposalId: vote.proposalId,
      proposalTitle: vote.proposalTitle,
      proposalType: vote.proposalType,
      drepVote: vote.vote,
      predictedUserStance: prediction.stance,
      stanceConfidence: prediction.confidence,
      agreement,
      reason,
      dimension: dimLabel,
      score: rankScore,
      dimKey: primaryDim,
    });
  }

  // If no proposals were classifiable, return null
  if (processed.length === 0) return null;

  // Sort by ranking score descending
  processed.sort((a, b) => b.score - a.score);

  // Pick top agreements and disagreements
  const agreements = processed.filter((p) => p.agreement === 'agree');
  const disagreements = processed.filter((p) => p.agreement === 'disagree');

  const topAgreements: ProposalAlignmentResult[] = agreements
    .slice(0, maxAgreements)
    .map(({ score: _s, dimKey: _d, ...rest }) => rest);

  const topDisagreements: ProposalAlignmentResult[] = disagreements
    .slice(0, maxDisagreements)
    .map(({ score: _s, dimKey: _d, ...rest }) => rest);

  // Compute dimension-level agreement using existing computeDimensionAgreement
  // Build an approximate DRep alignment from their vote patterns
  const drepScores = buildDRepAlignmentFromVotes(processed);
  const dimensionBreakdown = computeDimensionAgreement(userAlignment, drepScores);

  // Compute overall alignment as weighted average of dimension agreements
  const dimValues = Object.values(dimensionBreakdown.dimensionAgreement);
  const overallAlignment =
    dimValues.length > 0
      ? Math.round(dimValues.reduce((sum, v) => sum + v, 0) / dimValues.length)
      : null;

  // Confidence label based on data quality
  const classifiedCount = processed.length;
  const confidenceScore = Math.min(100, Math.round((classifiedCount / 15) * 100));
  const confidenceLabel = getConfidenceLabel(confidenceScore);

  // Generate narrative
  const narrative = generateMatchNarrative({
    agreeDimensions: dimensionBreakdown.agreeDimensions,
    differDimensions: dimensionBreakdown.differDimensions,
  });

  return {
    overallAlignment,
    confidence: confidenceScore,
    confidenceLabel,
    topAgreements,
    topDisagreements,
    dimensionBreakdown,
    narrative,
  };
}

/* ─── Internal helpers ────────────────────────────────── */

/**
 * Build approximate DRep alignment scores from their classified votes.
 * Used for dimension-level agreement computation.
 */
function buildDRepAlignmentFromVotes(
  processed: { dimKey: AlignmentDimension; agreement: string; drepVote: string }[],
): AlignmentScores {
  const totals: Record<AlignmentDimension, number> = {
    treasuryConservative: 0,
    treasuryGrowth: 0,
    decentralization: 0,
    security: 0,
    innovation: 0,
    transparency: 0,
  };
  const counts: Record<AlignmentDimension, number> = {
    treasuryConservative: 0,
    treasuryGrowth: 0,
    decentralization: 0,
    security: 0,
    innovation: 0,
    transparency: 0,
  };

  for (const item of processed) {
    const voteVal = item.drepVote === 'Yes' ? 100 : item.drepVote === 'No' ? 0 : 50;
    totals[item.dimKey] += voteVal;
    counts[item.dimKey]++;
  }

  const scores: AlignmentScores = {
    treasuryConservative: null,
    treasuryGrowth: null,
    decentralization: null,
    security: null,
    innovation: null,
    transparency: null,
  };

  for (const dim of DIMENSIONS) {
    if (counts[dim] > 0) {
      scores[dim] = Math.round(totals[dim] / counts[dim]);
    }
  }

  return scores;
}

/**
 * Generate a human-readable confidence label.
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 70) return 'High confidence — based on many classified proposals';
  if (confidence >= 40) return 'Moderate confidence — based on several classified proposals';
  if (confidence > 0) return 'Low confidence — based on limited data';
  return 'No data — cannot assess alignment';
}
