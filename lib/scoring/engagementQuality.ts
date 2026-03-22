/**
 * Engagement Quality pillar (40% of DRep Score V3.2).
 * Three layers: Provision Rate, Rationale Quality (with dissent-with-substance modifier),
 * Deliberation Signal (rationale diversity + coverage breadth).
 *
 * V3.2 changes:
 * - Vote diversity removed (penalized honest voting patterns)
 * - Dissent rate removed as standalone signal (incentivized strategic contrarianism)
 * - Added: rationale diversity via meta_hash uniqueness (catches copy-paste)
 * - Added: coverage breadth weighted by proposal frequency (doesn't penalize specialization)
 * - Added: dissent-with-substance modifier on rationale quality layer
 */

import { DECAY_LAMBDA, type VoteData, type ProposalVotingSummary } from './types';
import {
  ENGAGEMENT_LAYER_WEIGHTS,
  DELIBERATION_WEIGHTS,
  RATIONALE_DIVERSITY_CONFIG,
  DISSENT_SUBSTANCE_MODIFIER,
} from './calibration';

const LAYER_WEIGHTS = ENGAGEMENT_LAYER_WEIGHTS;
const DELIB_WEIGHTS = DELIBERATION_WEIGHTS;
const INFO_ACTION = 'InfoAction';

/**
 * Compute raw Engagement Quality scores (0-100) for all DReps.
 *
 * @param drepVotes Map of drepId → their votes (enriched with rationale quality & importance)
 * @param votingSummaries Map of proposalKey → voting power summary (for majority determination)
 * @param proposalTypeCounts Map of proposalType → count of proposals of that type
 * @param nowSeconds Current unix timestamp
 */
export function computeEngagementQuality(
  drepVotes: Map<string, VoteData[]>,
  votingSummaries: Map<string, ProposalVotingSummary>,
  proposalTypeCounts: Map<string, number>,
  nowSeconds: number,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [drepId, votes] of drepVotes) {
    if (votes.length === 0) {
      scores.set(drepId, 0);
      continue;
    }

    const provision = computeProvisionRate(votes, nowSeconds);
    const quality = computeRationaleQuality(votes, votingSummaries, nowSeconds);
    const deliberation = computeDeliberationSignal(votes, proposalTypeCounts);

    const raw =
      provision * LAYER_WEIGHTS.provision +
      quality * LAYER_WEIGHTS.quality +
      deliberation * LAYER_WEIGHTS.deliberation;

    scores.set(drepId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Layer 1 — Provision Rate (40% of pillar).
 * Weighted by proposal importance and temporal decay.
 * InfoActions excluded (non-binding polls don't need rationale).
 */
function computeProvisionRate(votes: VoteData[], nowSeconds: number): number {
  let weightedHas = 0;
  let totalWeight = 0;

  for (const v of votes) {
    if (v.proposalType === INFO_ACTION) continue;

    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const w = v.importanceWeight * decay;

    totalWeight += w;
    if (v.rationaleQuality !== null && v.rationaleQuality > 0) {
      weightedHas += w;
    }
  }

  return totalWeight === 0 ? 0 : (weightedHas / totalWeight) * 100;
}

/**
 * Layer 2 — Rationale Quality (40% of pillar).
 * Weighted average of AI quality scores across votes, with importance and decay.
 * DReps with 0 rationales get 0. DReps with few but excellent rationales can score high.
 *
 * V3.2: Includes "dissent with substance" modifier — when a DRep votes against
 * the majority AND provides a quality rationale (≥ minQuality), the quality
 * contribution for that vote is boosted by the multiplier. Capped to maxVoteFraction
 * of total eligible votes to prevent always-dissent gaming.
 */
function computeRationaleQuality(
  votes: VoteData[],
  votingSummaries: Map<string, ProposalVotingSummary>,
  nowSeconds: number,
): number {
  let weightedQuality = 0;
  let totalWeight = 0;

  // Determine how many votes can receive the dissent modifier
  const eligibleVotes = votes.filter((v) => v.proposalType !== INFO_ACTION);
  const maxDissentBonuses = Math.floor(
    eligibleVotes.length * DISSENT_SUBSTANCE_MODIFIER.maxVoteFraction,
  );
  let dissentBonusesApplied = 0;

  for (const v of votes) {
    if (v.proposalType === INFO_ACTION) continue;
    if (v.rationaleQuality === null || v.rationaleQuality === 0) continue;

    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const w = v.importanceWeight * decay;

    let qualityScore = v.rationaleQuality;

    // Apply dissent-with-substance modifier
    if (
      dissentBonusesApplied < maxDissentBonuses &&
      v.rationaleQuality >= DISSENT_SUBSTANCE_MODIFIER.minQuality &&
      v.vote !== 'Abstain'
    ) {
      const summary = votingSummaries.get(v.proposalKey);
      if (summary) {
        const majority = summary.drepYesVotePower >= summary.drepNoVotePower ? 'Yes' : 'No';
        if (v.vote !== majority) {
          qualityScore = Math.min(100, v.rationaleQuality * DISSENT_SUBSTANCE_MODIFIER.multiplier);
          dissentBonusesApplied++;
        }
      }
    }

    totalWeight += w;
    weightedQuality += qualityScore * w;
  }

  return totalWeight === 0 ? 0 : weightedQuality / totalWeight;
}

/**
 * Layer 3 — Deliberation Signal (20% of pillar).
 * V3.2 sub-components: rationale diversity (60%) + coverage breadth (40%).
 */
function computeDeliberationSignal(
  votes: VoteData[],
  proposalTypeCounts: Map<string, number>,
): number {
  const diversity = computeRationaleDiversity(votes);
  const breadth = computeCoverageBreadth(votes, proposalTypeCounts);

  return diversity * DELIB_WEIGHTS.rationaleDiversity + breadth * DELIB_WEIGHTS.coverageBreadth;
}

/**
 * Rationale diversity: measures unique meta_hashes vs total votes with rationale.
 * Catches copy-paste rationales (same meta_hash reused across votes) without
 * penalizing vote direction. Below minRationales → neutral 50.
 *
 * Score = (unique meta_hashes / total votes with meta_hash) × 100
 */
export function computeRationaleDiversity(votes: VoteData[]): number {
  const hashVotes = votes.filter((v) => v.rationaleMetaHash != null);
  if (hashVotes.length < RATIONALE_DIVERSITY_CONFIG.minRationales) {
    return RATIONALE_DIVERSITY_CONFIG.neutralScore;
  }

  const uniqueHashes = new Set(hashVotes.map((v) => v.rationaleMetaHash));
  return (uniqueHashes.size / hashVotes.length) * 100;
}

/**
 * Coverage breadth: what fraction of governance surface area has this DRep covered,
 * weighted by proposal frequency. A DRep who votes on all treasury proposals
 * (90% of proposals) scores ~90 even if they miss the one HardFork.
 *
 * For each proposal type T:
 *   typeWeight[T] = count of proposals of type T / total proposals
 *   covered[T] = 1 if DRep voted on at least one T, else 0
 *
 * coverageScore = sum(covered[T] * typeWeight[T]) / sum(typeWeight[T]) * 100
 */
export function computeCoverageBreadth(
  votes: VoteData[],
  proposalTypeCounts: Map<string, number>,
): number {
  if (proposalTypeCounts.size === 0) return 50;

  const totalProposals = [...proposalTypeCounts.values()].reduce((a, b) => a + b, 0);
  if (totalProposals === 0) return 50;

  const votedTypes = new Set<string>();
  for (const v of votes) votedTypes.add(v.proposalType);

  let coveredWeight = 0;
  let totalWeight = 0;

  for (const [pType, count] of proposalTypeCounts) {
    const typeWeight = count / totalProposals;
    totalWeight += typeWeight;
    if (votedTypes.has(pType)) {
      coveredWeight += typeWeight;
    }
  }

  return totalWeight === 0 ? 50 : (coveredWeight / totalWeight) * 100;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
