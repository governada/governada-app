/**
 * Semantic Rationale Diversity — embedding-based copy-paste detection.
 *
 * Computes average pairwise cosine similarity across a DRep's rationale embeddings.
 * High similarity (e.g., 0.95) means near-identical rationales → low diversity score.
 * Low similarity (e.g., 0.3) means genuinely different arguments → high diversity score.
 *
 * Diversity score = (1 - avgCosineSimilarity) × 100
 *
 * This catches sophisticated gamers who slightly modify boilerplate to produce
 * different CIP-100 meta_hashes while submitting semantically identical content.
 */

import { RATIONALE_DIVERSITY_CONFIG } from './calibration';

/**
 * Compute cosine similarity between two vectors.
 * Returns 0 for zero-magnitude vectors (graceful edge case).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute semantic diversity score for a single DRep from their rationale embeddings.
 *
 * @param embeddings Array of embedding vectors (one per rationale)
 * @returns Diversity score 0-100, or null if insufficient embeddings
 */
export function computeSemanticDiversityScore(embeddings: number[][]): number | null {
  if (embeddings.length < RATIONALE_DIVERSITY_CONFIG.minEmbeddingsForSemantic) {
    return null;
  }

  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      totalSimilarity += cosineSimilarity(embeddings[i], embeddings[j]);
      pairCount++;
    }
  }

  if (pairCount === 0) return null;

  const avgSimilarity = totalSimilarity / pairCount;
  // Clamp to [0, 100] — similarity can theoretically be negative for some embeddings
  return Math.max(0, Math.min(100, (1 - avgSimilarity) * 100));
}

/**
 * Batch-compute semantic diversity scores for multiple DReps.
 *
 * @param drepEmbeddings Map of drepId → array of embedding vectors
 * @returns Map of drepId → semantic diversity score (0-100). DReps with insufficient
 *   embeddings are omitted from the result.
 */
export function computeSemanticDiversityMap(
  drepEmbeddings: Map<string, number[][]>,
): Map<string, number> {
  const result = new Map<string, number>();

  for (const [drepId, embeddings] of drepEmbeddings) {
    const score = computeSemanticDiversityScore(embeddings);
    if (score !== null) {
      result.set(drepId, score);
    }
  }

  return result;
}
