/**
 * Gaming Detection — Embedding-Based Anti-Gaming Signals
 *
 * Detects suspicious patterns using semantic embedding analysis:
 * 1. Rationale Farming: DReps producing many near-identical rationales
 * 2. Template Detection: Cross-DRep clusters using identical reasoning
 * 3. Profile-Vote Hypocrisy: Mismatch between stated profile and actual voting rationales
 *
 * All functions are gated behind the `embedding_anti_gaming` feature flag.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { computePairwiseDiversity, computeCentroid } from '@/lib/embeddings/quality';
import { cosineSimilarity } from '@/lib/embeddings/query';

// ---------------------------------------------------------------------------
// Rationale Farm Detection
// ---------------------------------------------------------------------------

export interface RationaleFarmResult {
  isSuspect: boolean;
  rationaleCount: number;
  meanSimilarity: number;
}

/**
 * Detect rationale farming: DRep with >= 10 rationales and mean pairwise
 * cosine similarity > 0.92 is flagged as suspect.
 *
 * A high mean similarity across many rationales suggests copy-paste or
 * template-based rationale generation rather than genuine deliberation.
 */
export async function detectRationaleFarming(drepId: string): Promise<RationaleFarmResult> {
  const supabase = getSupabaseAdmin();

  const { data: embeddings } = await supabase
    .from('embeddings')
    .select('embedding')
    .eq('entity_type', 'rationale')
    .eq('secondary_id', drepId)
    .limit(200);

  if (!embeddings?.length) {
    return { isSuspect: false, rationaleCount: 0, meanSimilarity: 0 };
  }

  const vectors = embeddings.map((e) => e.embedding as unknown as number[]);
  const rationaleCount = vectors.length;

  if (rationaleCount < 10) {
    return { isSuspect: false, rationaleCount, meanSimilarity: 0 };
  }

  // Compute mean pairwise similarity (inverse of diversity)
  const diversity = computePairwiseDiversity(vectors);
  const meanSimilarity = 1 - diversity;

  return {
    isSuspect: meanSimilarity > 0.92,
    rationaleCount,
    meanSimilarity: Math.round(meanSimilarity * 1000) / 1000,
  };
}

// ---------------------------------------------------------------------------
// Template Detection
// ---------------------------------------------------------------------------

export interface TemplateCluster {
  drepIds: string[];
  centroidDistance: number;
}

export interface TemplateDetectionResult {
  templateClusters: TemplateCluster[];
}

/**
 * Detect template usage across DReps for a specific proposal.
 * Cross-DRep cluster: > 5 rationales from different DReps with centroid distance < 0.05.
 *
 * This signals coordinated or template-based voting where multiple DReps
 * submit semantically identical rationales.
 */
export async function detectTemplateUsage(
  proposalEntityId: string,
): Promise<TemplateDetectionResult> {
  const supabase = getSupabaseAdmin();

  // Get all rationale embeddings for this proposal
  const { data: embeddings } = await supabase
    .from('embeddings')
    .select('secondary_id, embedding')
    .eq('entity_type', 'rationale')
    .eq('entity_id', proposalEntityId)
    .limit(500);

  if (!embeddings?.length || embeddings.length < 6) {
    return { templateClusters: [] };
  }

  // Group by DRep (secondary_id = voter_id)
  const drepEmbeddings = new Map<string, number[]>();
  for (const e of embeddings) {
    if (e.secondary_id) {
      drepEmbeddings.set(e.secondary_id, e.embedding as unknown as number[]);
    }
  }

  if (drepEmbeddings.size < 6) {
    return { templateClusters: [] };
  }

  // Simple greedy clustering: find groups of DReps with very similar rationales
  const entries = Array.from(drepEmbeddings.entries());
  const clustered = new Set<string>();
  const clusters: TemplateCluster[] = [];

  for (let i = 0; i < entries.length; i++) {
    if (clustered.has(entries[i][0])) continue;

    const clusterMembers: string[] = [entries[i][0]];
    const clusterVectors: number[][] = [entries[i][1]];

    for (let j = i + 1; j < entries.length; j++) {
      if (clustered.has(entries[j][0])) continue;

      // Check similarity against all current cluster members
      const similarities = clusterVectors.map((v) => cosineSimilarity(v, entries[j][1]));
      const minSim = Math.min(...similarities);

      if (minSim > 0.95) {
        clusterMembers.push(entries[j][0]);
        clusterVectors.push(entries[j][1]);
      }
    }

    if (clusterMembers.length > 5) {
      const centroid = computeCentroid(clusterVectors);
      // Centroid distance = mean distance from centroid
      const distances = clusterVectors.map((v) => 1 - cosineSimilarity(v, centroid));
      const centroidDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

      if (centroidDistance < 0.05) {
        clusters.push({
          drepIds: clusterMembers.sort(),
          centroidDistance: Math.round(centroidDistance * 10000) / 10000,
        });
        for (const id of clusterMembers) {
          clustered.add(id);
        }
      }
    }
  }

  return { templateClusters: clusters };
}

// ---------------------------------------------------------------------------
// Profile-Vote Hypocrisy
// ---------------------------------------------------------------------------

export interface HypocrisyResult {
  consistencyScore: number; // 0-100
  isMismatch: boolean;
}

/**
 * Detect profile-vote hypocrisy: compare a DRep's profile embedding against
 * the centroid of their rationale embeddings.
 *
 * Consistency score < 20 = mismatch flag (profile says one thing, votes say another).
 */
export async function detectProfileVoteHypocrisy(drepId: string): Promise<HypocrisyResult> {
  const supabase = getSupabaseAdmin();

  // Get DRep profile embedding
  const { data: profileData } = await supabase
    .from('embeddings')
    .select('embedding')
    .eq('entity_type', 'drep_profile')
    .eq('entity_id', drepId)
    .is('secondary_id', null)
    .single();

  if (!profileData?.embedding) {
    return { consistencyScore: 50, isMismatch: false };
  }

  // Get DRep rationale embeddings
  const { data: rationaleData } = await supabase
    .from('embeddings')
    .select('embedding')
    .eq('entity_type', 'rationale')
    .eq('secondary_id', drepId)
    .limit(100);

  if (!rationaleData?.length || rationaleData.length < 3) {
    // Not enough rationales to assess; return neutral
    return { consistencyScore: 50, isMismatch: false };
  }

  const profileEmb = profileData.embedding as unknown as number[];
  const rationaleEmbs = rationaleData.map((r) => r.embedding as unknown as number[]);
  const rationaleCentroid = computeCentroid(rationaleEmbs);

  // Cosine similarity: -1 to 1. Map to 0-100 consistency score.
  const similarity = cosineSimilarity(profileEmb, rationaleCentroid);
  const consistencyScore = Math.round(Math.max(0, similarity) * 100);

  return {
    consistencyScore,
    isMismatch: consistencyScore < 20,
  };
}
