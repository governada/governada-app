/**
 * Compute alignment vectors from voting patterns.
 *
 * Used to derive 6D alignment vectors for CC members and SPOs based on
 * how their votes correlate with the existing DRep alignment landscape.
 *
 * Strategy: for each proposal an entity voted on, find DReps who voted the
 * same way, and average their alignment vectors. The entity's alignment
 * becomes the weighted average of these per-proposal vectors — effectively
 * positioning the entity near the DReps it votes with.
 */

import type { AlignmentDimension } from '@/lib/drepIdentity';
import { DIMENSION_ORDER } from '@/lib/drepIdentity';

interface VoteRecord {
  proposalKey: string; // tx_hash or tx_hash:index
  vote: string; // 'Yes' | 'No' | 'Abstain'
}

interface DRepAlignmentRef {
  id: string;
  alignments: number[]; // 6D alignment vector
  votes: Map<string, string>; // proposalKey → vote
}

/**
 * Compute a 6D alignment vector for an entity based on how its votes
 * correlate with DRep alignment vectors.
 *
 * Returns [50,50,50,50,50,50] if insufficient data (< 3 matching proposals).
 */
export function computeAlignmentFromVotes(
  entityVotes: VoteRecord[],
  drepRefs: DRepAlignmentRef[],
): number[] {
  const neutral = [50, 50, 50, 50, 50, 50];
  if (entityVotes.length < 3 || drepRefs.length === 0) return neutral;

  const accumulated = new Float64Array(6);
  let totalWeight = 0;

  for (const entityVote of entityVotes) {
    // Find DReps who voted the same way on this proposal
    const agreeing: DRepAlignmentRef[] = [];
    for (const drep of drepRefs) {
      const drepVote = drep.votes.get(entityVote.proposalKey);
      if (drepVote === entityVote.vote) {
        agreeing.push(drep);
      }
    }

    if (agreeing.length < 2) continue; // Need meaningful sample

    // Average alignment of agreeing DReps
    const avg = new Float64Array(6);
    for (const drep of agreeing) {
      for (let d = 0; d < 6; d++) {
        avg[d] += drep.alignments[d] ?? 50;
      }
    }
    for (let d = 0; d < 6; d++) {
      avg[d] /= agreeing.length;
    }

    // Weight by number of agreeing DReps (more agreement = stronger signal)
    const weight = Math.min(agreeing.length / 10, 1); // cap at 1.0 for 10+ DReps
    for (let d = 0; d < 6; d++) {
      accumulated[d] += avg[d] * weight;
    }
    totalWeight += weight;
  }

  if (totalWeight < 1) return neutral; // Not enough matching data

  // Normalize and return
  const result: number[] = [];
  for (let d = 0; d < 6; d++) {
    const val = accumulated[d] / totalWeight;
    result.push(Math.round(Math.max(0, Math.min(100, val))));
  }
  return result;
}

/**
 * Build DRep alignment reference data for correlation computation.
 * Extracts alignment vectors and vote maps from DRep data + vote records.
 */
export function buildDRepAlignmentRefs(
  dreps: Array<{
    id: string;
    alignments: number[];
  }>,
  drepVotes: Array<{
    drep_id: string;
    proposal_tx_hash: string;
    vote: string;
  }>,
): DRepAlignmentRef[] {
  // Build vote map per DRep
  const voteMaps = new Map<string, Map<string, string>>();
  for (const v of drepVotes) {
    const drepId = (v.drep_id as string).slice(0, 16);
    let map = voteMaps.get(drepId);
    if (!map) {
      map = new Map();
      voteMaps.set(drepId, map);
    }
    map.set(v.proposal_tx_hash, v.vote);
  }

  const refs: DRepAlignmentRef[] = [];
  for (const drep of dreps) {
    const voteMap = voteMaps.get(drep.id);
    if (!voteMap || voteMap.size === 0) continue;
    // Only include DReps with non-neutral alignment (at least one non-50 dimension)
    const hasAlignment = drep.alignments.some((v) => Math.abs(v - 50) > 5);
    if (!hasAlignment) continue;

    refs.push({
      id: drep.id,
      alignments: drep.alignments,
      votes: voteMap,
    });
  }

  return refs;
}

export { DIMENSION_ORDER };
export type { VoteRecord, DRepAlignmentRef };
