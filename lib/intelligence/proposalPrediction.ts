/**
 * Proposal Support Prediction — estimates DRep support for a proposal
 * based on alignment distance between proposal dimensions and community data.
 *
 * Uses a simplified model: cosine similarity between the proposal's alignment
 * vector and the community centroid predicts how aligned the proposal is with
 * the broader citizen base. DRep average alignment is used when available for
 * a more direct prediction.
 */

import type { AlignmentScores } from '@/lib/drepIdentity';

/* ─── Types ─────────────────────────────────────────────── */

export interface ProposalPrediction {
  /** Estimated support percentage (0-100) */
  estimatedSupport: number;
  /** Confidence level based on available data */
  confidence: 'high' | 'medium' | 'low';
  /** Breakdown of expected DRep positions */
  breakdown: {
    likely_yes: number;
    likely_no: number;
    uncertain: number;
  };
}

export interface CommunityData {
  communityCentroid: number[];
  drepAvgAlignment?: number[];
  totalSessions?: number;
  totalDreps?: number;
}

/* ─── Constants ─────────────────────────────────────────── */

const DIMENSION_KEYS: (keyof AlignmentScores)[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

/* ─── Helpers ───────────────────────────────────────────── */

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
}

/* ─── Main Prediction Function ──────────────────────────── */

/**
 * Predict DRep support for a proposal given its alignment dimensions and
 * community intelligence data.
 *
 * The model:
 * 1. Compute cosine similarity between proposal vector and DRep average alignment
 *    (falls back to community centroid if DRep average is unavailable).
 * 2. Map similarity to estimated support percentage.
 * 3. Derive a breakdown using a simple distribution model.
 */
export function predictProposalSupport(
  proposalAlignments: Partial<AlignmentScores>,
  communityData: CommunityData,
): ProposalPrediction {
  // Convert proposal alignments to ordered array
  const proposalVector = DIMENSION_KEYS.map((k) => (proposalAlignments[k] as number) ?? 50);

  // Use DRep average alignment if available, otherwise community centroid
  const referenceVector = communityData.drepAvgAlignment ?? communityData.communityCentroid;

  // Compute similarity (0-1)
  const similarity = cosineSimilarity(proposalVector, referenceVector);

  // Map similarity to support estimate
  // Cosine similarity for governance vectors tends to cluster 0.7-1.0
  // Use sigmoid-like mapping for more useful 30-95% range
  const adjustedSupport = Math.round(30 + 65 * (1 / (1 + Math.exp(-8 * (similarity - 0.85)))));
  const estimatedSupport = Math.max(10, Math.min(95, adjustedSupport));

  // Confidence based on data quality
  const totalSessions = communityData.totalSessions ?? 0;
  const hasDrepData = !!communityData.drepAvgAlignment;
  const totalDreps = communityData.totalDreps ?? 0;

  let confidence: 'high' | 'medium' | 'low';
  if (hasDrepData && totalDreps >= 20 && totalSessions >= 10) {
    confidence = 'high';
  } else if (totalSessions >= 5 || totalDreps >= 10) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Breakdown: distribute estimated total DReps into yes/no/uncertain
  const estimatedTotalDreps = totalDreps > 0 ? totalDreps : 100;
  const yesRatio = estimatedSupport / 100;
  const noRatio = Math.max(0, (100 - estimatedSupport - 15) / 100); // 15% uncertain band
  const uncertainRatio = 1 - yesRatio - noRatio;

  return {
    estimatedSupport,
    confidence,
    breakdown: {
      likely_yes: Math.round(estimatedTotalDreps * yesRatio),
      likely_no: Math.round(estimatedTotalDreps * Math.max(0, noRatio)),
      uncertain: Math.round(estimatedTotalDreps * Math.max(0, uncertainRatio)),
    },
  };
}
