/**
 * Classification-Based Proposal Similarity
 *
 * Uses cosine similarity on 6D classification vectors from proposal_classifications.
 *
 * When `embedding_proposal_similarity` flag is ON, computes a hybrid score:
 *   0.4 * classificationSimilarity + 0.6 * embeddingSimilarity
 * using precomputed embedding similarities from `semantic_similarity_cache`.
 * Falls back to classification-only when embeddings are unavailable.
 */

import { getSupabaseAdmin, createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getFeatureFlag } from '@/lib/featureFlags';
import {
  getEntityEmbedding,
  cosineSimilarity as embeddingCosineSimilarity,
} from '@/lib/embeddings';

export interface SimilarProposalResult {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  similarityScore: number;
}

interface ClassificationVector {
  txHash: string;
  index: number;
  vector: number[];
}

const DIMENSIONS = [
  'dim_treasury_conservative',
  'dim_treasury_growth',
  'dim_decentralization',
  'dim_security',
  'dim_innovation',
  'dim_transparency',
] as const;

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

function isNonZeroVector(v: number[]): boolean {
  return v.some((x) => x !== 0);
}

/**
 * Compute similarity between two proposals using their classification vectors.
 */
export function computeProposalSimilarity(vecA: number[], vecB: number[]): number {
  if (!isNonZeroVector(vecA) || !isNonZeroVector(vecB)) return 0;
  return cosineSimilarity(vecA, vecB);
}

/**
 * Find top-N similar proposals to a given proposal by classification vector.
 *
 * When `embedding_proposal_similarity` flag is ON, computes hybrid scores
 * using both classification and embedding similarity.
 */
export async function findSimilarByClassification(
  txHash: string,
  index: number,
  limit = 5,
): Promise<SimilarProposalResult[]> {
  const supabase = createClient();

  const { data: source } = await supabase
    .from('proposal_classifications')
    .select('*')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', index)
    .single();

  if (!source) return [];

  const sourceRow = source as unknown as Record<string, number | string>;
  const sourceVec = DIMENSIONS.map((d) => Number(sourceRow[d]) || 0);
  if (!isNonZeroVector(sourceVec)) return [];

  const { data: allClassifications } = await supabase.from('proposal_classifications').select('*');

  if (!allClassifications) return [];

  const allRows = (allClassifications || []) as unknown as Array<Record<string, number | string>>;

  // Compute classification similarity for all candidates
  const classificationScored = allRows
    .filter((c) => !(c.proposal_tx_hash === txHash && c.proposal_index === index))
    .map((c) => {
      const vec = DIMENSIONS.map((d) => Number(c[d]) || 0);
      return {
        txHash: c.proposal_tx_hash as string,
        index: c.proposal_index as number,
        classificationScore: computeProposalSimilarity(sourceVec, vec),
      };
    })
    .filter((s) => s.classificationScore > 0.1);

  if (classificationScored.length === 0) return [];

  // Check if hybrid scoring is enabled
  const useHybrid = await getFeatureFlag('embedding_proposal_similarity', false);
  let embeddingScores: Map<string, number> | null = null;

  if (useHybrid) {
    embeddingScores = await getEmbeddingSimilarities(txHash, classificationScored);
  }

  // Compute final scores
  const scored = classificationScored
    .map((s) => {
      const key = `${s.txHash}-${s.index}`;
      const embScore = embeddingScores?.get(key);

      // Hybrid: 0.4 classification + 0.6 embedding (when available)
      // Falls back to classification-only if no embedding for this pair
      const score =
        embeddingScores && embScore !== undefined
          ? CLASSIFICATION_WEIGHT * s.classificationScore + EMBEDDING_WEIGHT * embScore
          : s.classificationScore;

      return {
        txHash: s.txHash,
        index: s.index,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) return [];

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type')
    .in(
      'tx_hash',
      scored.map((s) => s.txHash),
    );

  const proposalMap = new Map(
    (proposals || []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p]),
  );

  return scored.map((s) => {
    const p = proposalMap.get(`${s.txHash}-${s.index}`);
    return {
      txHash: s.txHash,
      index: s.index,
      title: p?.title || 'Untitled',
      proposalType: p?.proposal_type || 'Unknown',
      similarityScore: Math.round(s.score * 100) / 100,
    };
  });
}

/** Hybrid scoring weights */
const CLASSIFICATION_WEIGHT = 0.4;
const EMBEDDING_WEIGHT = 0.6;

/**
 * Fetch embedding similarities for the source proposal vs candidates.
 * Tries precomputed cache first, falls back to live computation.
 */
async function getEmbeddingSimilarities(
  sourceTxHash: string,
  candidates: Array<{ txHash: string; index: number }>,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  try {
    const supabase = createClient();

    // Try precomputed cache first
    const { data: cached } = await supabase
      .from('semantic_similarity_cache')
      .select('target_entity_id, similarity')
      .eq('source_entity_type', 'proposal')
      .eq('source_entity_id', sourceTxHash)
      .eq('target_entity_type', 'proposal')
      .in(
        'target_entity_id',
        candidates.map((c) => c.txHash),
      );

    if (cached && cached.length > 0) {
      for (const row of cached) {
        // Map using first candidate with this txHash to get the index
        const candidate = candidates.find((c) => c.txHash === row.target_entity_id);
        if (candidate) {
          result.set(`${row.target_entity_id}-${candidate.index}`, row.similarity);
        }
      }
    }

    // For candidates not in cache, try live embedding comparison
    const uncachedCandidates = candidates.filter((c) => !result.has(`${c.txHash}-${c.index}`));

    if (uncachedCandidates.length > 0) {
      const sourceEmbedding = await getEntityEmbedding('proposal', sourceTxHash);
      if (sourceEmbedding) {
        for (const candidate of uncachedCandidates) {
          const targetEmbedding = await getEntityEmbedding('proposal', candidate.txHash);
          if (targetEmbedding) {
            const similarity = embeddingCosineSimilarity(sourceEmbedding, targetEmbedding);
            result.set(`${candidate.txHash}-${candidate.index}`, similarity);
          }
        }
      }
    }
  } catch (err) {
    logger.warn(
      '[proposalSimilarity] Embedding similarity lookup failed, using classification only',
      {
        error: err,
      },
    );
  }

  return result;
}

/**
 * Precompute top-5 similar proposals for each classified proposal.
 * Stores results in proposal_similarity_cache.
 *
 * When `embedding_proposal_similarity` flag is ON, also precomputes
 * semantic similarity pairs into `semantic_similarity_cache`.
 */
export async function precomputeSimilarityCache(): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data: rawClassifications } = await supabase.from('proposal_classifications').select('*');

  const allClassifications = (rawClassifications || []) as unknown as Array<
    Record<string, number | string>
  >;
  if (allClassifications.length < 2) return 0;

  const vectors: ClassificationVector[] = allClassifications
    .map((c) => ({
      txHash: c.proposal_tx_hash as string,
      index: c.proposal_index as number,
      vector: DIMENSIONS.map((d) => Number(c[d]) || 0),
    }))
    .filter((v) => isNonZeroVector(v.vector));

  if (vectors.length < 2) return 0;

  const rows: Array<{
    proposal_tx_hash: string;
    proposal_index: number;
    similar_tx_hash: string;
    similar_index: number;
    similarity_score: number;
    computed_at: string;
  }> = [];

  const now = new Date().toISOString();

  for (const source of vectors) {
    const similarities = vectors
      .filter((t) => !(t.txHash === source.txHash && t.index === source.index))
      .map((target) => ({
        target,
        score: computeProposalSimilarity(source.vector, target.vector),
      }))
      .filter((s) => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    for (const { target, score } of similarities) {
      rows.push({
        proposal_tx_hash: source.txHash,
        proposal_index: source.index,
        similar_tx_hash: target.txHash,
        similar_index: target.index,
        similarity_score: Math.round(score * 1000) / 1000,
        computed_at: now,
      });
    }
  }

  if (rows.length === 0) return 0;

  const BATCH_SIZE = 200;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('proposal_similarity_cache').upsert(batch, {
      onConflict: 'proposal_tx_hash,proposal_index,similar_tx_hash,similar_index',
    });
    if (!error) upserted += batch.length;
    else logger.error('[proposalSimilarity] Batch upsert error', { error: error.message });
  }

  // When embedding flag is ON, also precompute semantic similarity pairs
  const useEmbeddings = await getFeatureFlag('embedding_proposal_similarity', false);
  if (useEmbeddings) {
    const embeddingPairs = await precomputeEmbeddingSimilarityCache(vectors, supabase);
    logger.info('[proposalSimilarity] Embedding similarity cache updated', {
      pairs: embeddingPairs,
    });
  }

  return upserted;
}

/**
 * Precompute embedding-based similarity pairs for proposals that have embeddings.
 * Stores results in `semantic_similarity_cache` for fast lookup at query time.
 */
async function precomputeEmbeddingSimilarityCache(
  vectors: ClassificationVector[],
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<number> {
  // Fetch all proposal embeddings
  const txHashes = [...new Set(vectors.map((v) => v.txHash))];
  const embeddingMap = new Map<string, number[]>();

  // Fetch in batches to avoid query size limits
  const FETCH_BATCH = 50;
  for (let i = 0; i < txHashes.length; i += FETCH_BATCH) {
    const batch = txHashes.slice(i, i + FETCH_BATCH);
    const { data } = await supabase
      .from('embeddings')
      .select('entity_id, embedding')
      .eq('entity_type', 'proposal')
      .in('entity_id', batch);

    if (data) {
      for (const row of data) {
        embeddingMap.set(row.entity_id, row.embedding as unknown as number[]);
      }
    }
  }

  if (embeddingMap.size < 2) return 0;

  const embeddedHashes = [...embeddingMap.keys()];
  const semanticRows: Array<{
    source_entity_type: string;
    source_entity_id: string;
    target_entity_type: string;
    target_entity_id: string;
    similarity: number;
    computed_at: string;
  }> = [];

  const now = new Date().toISOString();

  for (let i = 0; i < embeddedHashes.length; i++) {
    const sourceHash = embeddedHashes[i];
    const sourceEmb = embeddingMap.get(sourceHash)!;

    const similarities = embeddedHashes
      .slice(i + 1) // Only compute each pair once (i < j)
      .map((targetHash) => ({
        targetHash,
        score: embeddingCosineSimilarity(sourceEmb, embeddingMap.get(targetHash)!),
      }))
      .filter((s) => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    for (const { targetHash, score } of similarities) {
      const roundedScore = Math.round(score * 1000) / 1000;
      // Store both directions for fast lookup
      semanticRows.push({
        source_entity_type: 'proposal',
        source_entity_id: sourceHash,
        target_entity_type: 'proposal',
        target_entity_id: targetHash,
        similarity: roundedScore,
        computed_at: now,
      });
      semanticRows.push({
        source_entity_type: 'proposal',
        source_entity_id: targetHash,
        target_entity_type: 'proposal',
        target_entity_id: sourceHash,
        similarity: roundedScore,
        computed_at: now,
      });
    }
  }

  if (semanticRows.length === 0) return 0;

  let upserted = 0;
  const BATCH_SIZE = 200;

  for (let i = 0; i < semanticRows.length; i += BATCH_SIZE) {
    const batch = semanticRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('semantic_similarity_cache').upsert(batch, {
      onConflict: 'source_entity_type,source_entity_id,target_entity_type,target_entity_id',
    });
    if (!error) upserted += batch.length;
    else logger.error('[proposalSimilarity] Semantic cache upsert error', { error: error.message });
  }

  return upserted;
}
