/**
 * Sybil Detection for SPO Score V3.
 * Flags SPO pairs with >95% vote correlation (same votes on same proposals).
 * Does NOT affect scores directly — creates a deterrent and audit trail.
 *
 * Enhanced (when `embedding_anti_gaming` flag is ON):
 * - Also checks rationale embedding correlation
 * - High confidence sybil: vote correlation > 95% AND rationale correlation > 90%
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { computeCentroid } from '@/lib/embeddings/quality';
import { cosineSimilarity } from '@/lib/embeddings/query';

export interface SybilFlag {
  poolA: string;
  poolB: string;
  agreementRate: number;
  sharedVotes: number;
  /** Rationale embedding correlation (0-1). Only present when embedding-enhanced. */
  rationaleCorrelation?: number;
  /** True when both vote AND rationale correlation thresholds are met. */
  highConfidence?: boolean;
}

/**
 * Detect SPO pairs with suspiciously high vote correlation.
 * Only considers pairs with >= minSharedVotes common proposals.
 */
export function detectSybilPairs(
  poolVoteMap: Map<string, Map<string, 'Yes' | 'No' | 'Abstain'>>,
  threshold: number = 0.95,
  minSharedVotes: number = 5,
): SybilFlag[] {
  const flags: SybilFlag[] = [];
  const poolIds = [...poolVoteMap.keys()];

  for (let i = 0; i < poolIds.length; i++) {
    const votesA = poolVoteMap.get(poolIds[i])!;

    for (let j = i + 1; j < poolIds.length; j++) {
      const votesB = poolVoteMap.get(poolIds[j])!;

      // Find shared proposals
      let shared = 0;
      let agreed = 0;

      for (const [proposalKey, voteA] of votesA) {
        const voteB = votesB.get(proposalKey);
        if (voteB !== undefined) {
          shared++;
          if (voteA === voteB) agreed++;
        }
      }

      if (shared >= minSharedVotes) {
        const agreementRate = agreed / shared;
        if (agreementRate >= threshold) {
          flags.push({
            poolA: poolIds[i],
            poolB: poolIds[j],
            agreementRate: Math.round(agreementRate * 1000) / 1000,
            sharedVotes: shared,
          });
        }
      }
    }
  }

  return flags;
}

/**
 * Enhanced sybil detection combining vote correlation with rationale embedding correlation.
 * When `embedding_anti_gaming` flag is ON, this enriches standard sybil flags
 * with rationale similarity data and a high-confidence classification.
 *
 * High confidence sybil: vote correlation > 95% AND rationale correlation > 90%.
 */
export async function enhanceSybilWithEmbeddings(flags: SybilFlag[]): Promise<SybilFlag[]> {
  if (flags.length === 0) return flags;

  const supabase = getSupabaseAdmin();

  // Collect all pool IDs that need rationale embeddings
  const poolIds = new Set<string>();
  for (const flag of flags) {
    poolIds.add(flag.poolA);
    poolIds.add(flag.poolB);
  }

  // Fetch rationale embeddings for these entities
  // For SPOs, the secondary_id stores the voter (pool) ID
  const { data: embeddings } = await supabase
    .from('embeddings')
    .select('secondary_id, embedding')
    .eq('entity_type', 'rationale')
    .in('secondary_id', Array.from(poolIds))
    .limit(2000);

  if (!embeddings?.length) {
    // No embedding data — return original flags unchanged
    return flags;
  }

  // Group embeddings by pool and compute centroids
  const poolEmbeddings = new Map<string, number[][]>();
  for (const e of embeddings) {
    if (e.secondary_id) {
      const group = poolEmbeddings.get(e.secondary_id) ?? [];
      group.push(e.embedding as unknown as number[]);
      poolEmbeddings.set(e.secondary_id, group);
    }
  }

  const poolCentroids = new Map<string, number[]>();
  for (const [poolId, embs] of poolEmbeddings) {
    if (embs.length >= 2) {
      poolCentroids.set(poolId, computeCentroid(embs));
    }
  }

  // Enrich each flag with rationale correlation
  return flags.map((flag) => {
    const centroidA = poolCentroids.get(flag.poolA);
    const centroidB = poolCentroids.get(flag.poolB);

    if (!centroidA || !centroidB) {
      return flag; // No embedding data for one or both — return as-is
    }

    const rationaleCorrelation = Math.round(cosineSimilarity(centroidA, centroidB) * 1000) / 1000;

    return {
      ...flag,
      rationaleCorrelation,
      highConfidence: flag.agreementRate > 0.95 && rationaleCorrelation > 0.9,
    };
  });
}
