/**
 * Entity Similarity Network
 *
 * DRep similarity using 6D alignment space (cosine distance).
 * Proposal similarity using classification vectors + optional pgvector embeddings.
 *
 * DRep similarity: leverages the existing PCA coordinates in `drep_pca_coordinates`
 * and falls back to 6D alignment columns in `dreps` if PCA is unavailable.
 *
 * Proposal similarity: delegates to `lib/proposalSimilarity.ts` which already
 * implements hybrid classification + embedding similarity.
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimilarDRep {
  drepId: string;
  name: string | null;
  score: number;
  similarity: number; // 0-100
  isActive: boolean;
  delegatorCount: number;
}

// ---------------------------------------------------------------------------
// DRep Similarity (6D alignment space)
// ---------------------------------------------------------------------------

/**
 * Find DReps most similar to the given DRep by alignment vector.
 *
 * Strategy:
 * 1. Try PCA coordinates (more dimensions, better signal) via existing `drep_pca_coordinates`
 * 2. Fall back to 6D alignment columns in the `dreps` table
 */
export async function findSimilarDReps(drepId: string, limit = 10): Promise<SimilarDRep[]> {
  const supabase = createClient();

  // Try PCA-based similarity first (higher quality)
  const pcaResult = await findSimilarByPCA(supabase, drepId, limit);
  if (pcaResult.length > 0) return pcaResult;

  // Fallback: 6D alignment column similarity
  return findSimilarByAlignment(supabase, drepId, limit);
}

async function findSimilarByPCA(
  supabase: ReturnType<typeof createClient>,
  drepId: string,
  limit: number,
): Promise<SimilarDRep[]> {
  try {
    const { loadActivePCA } = await import('@/lib/alignment/pca');
    const pca = await loadActivePCA();
    if (!pca) return [];

    const { data: coordRows } = await supabase
      .from('drep_pca_coordinates')
      .select('drep_id, coordinates')
      .eq('run_id', pca.runId);

    if (!coordRows?.length) return [];

    const targetRow = coordRows.find((r) => r.drep_id === drepId);
    if (!targetRow) return [];

    const targetCoords = targetRow.coordinates as number[];

    const similarities = coordRows
      .filter((r) => r.drep_id !== drepId)
      .map((r) => ({
        drepId: r.drep_id as string,
        similarity: cosineDistance(targetCoords, r.coordinates as number[]),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return enrichSimilarDReps(supabase, similarities);
  } catch (err) {
    logger.warn('[similarity] PCA-based similarity failed', { error: err });
    return [];
  }
}

async function findSimilarByAlignment(
  supabase: ReturnType<typeof createClient>,
  drepId: string,
  limit: number,
): Promise<SimilarDRep[]> {
  // Fetch target DRep's alignment
  const { data: target } = await supabase
    .from('dreps')
    .select(
      'id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .eq('id', drepId)
    .maybeSingle();

  if (!target) return [];

  const targetVec = extractAlignmentVec(target);

  // Check if target has non-default alignment
  if (targetVec.every((v) => v === 50)) return [];

  // Fetch all DReps with alignment data
  const { data: allDreps } = await supabase
    .from('dreps')
    .select(
      'id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .not('alignment_treasury_conservative', 'is', null);

  if (!allDreps || allDreps.length < 2) return [];

  const similarities = allDreps
    .filter((d) => d.id !== drepId)
    .map((d) => {
      const vec = extractAlignmentVec(d);
      return {
        drepId: d.id,
        similarity: cosineDistance(targetVec, vec),
      };
    })
    .filter((s) => s.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return enrichSimilarDReps(supabase, similarities);
}

function extractAlignmentVec(row: {
  alignment_treasury_conservative: number | null;
  alignment_treasury_growth: number | null;
  alignment_decentralization: number | null;
  alignment_security: number | null;
  alignment_innovation: number | null;
  alignment_transparency: number | null;
}): number[] {
  return [
    row.alignment_treasury_conservative ?? 50,
    row.alignment_treasury_growth ?? 50,
    row.alignment_decentralization ?? 50,
    row.alignment_security ?? 50,
    row.alignment_innovation ?? 50,
    row.alignment_transparency ?? 50,
  ];
}

async function enrichSimilarDReps(
  supabase: ReturnType<typeof createClient>,
  similarities: Array<{ drepId: string; similarity: number }>,
): Promise<SimilarDRep[]> {
  if (similarities.length === 0) return [];

  const { data: drepRows } = await supabase
    .from('dreps')
    .select('id, info, score, is_active')
    .in(
      'id',
      similarities.map((s) => s.drepId),
    );

  const infoMap = new Map<
    string,
    { name: string | null; score: number; isActive: boolean; delegatorCount: number }
  >();
  if (drepRows) {
    for (const d of drepRows) {
      const info = (d.info ?? {}) as Record<string, unknown>;
      infoMap.set(d.id, {
        name: (info.name as string) || null,
        score: Number(d.score) || 0,
        isActive: d.is_active ?? true,
        delegatorCount: (info.delegatorCount as number) ?? 0,
      });
    }
  }

  // Only return DReps with names
  return similarities
    .filter((s) => {
      const info = infoMap.get(s.drepId);
      return info?.name != null;
    })
    .map((s) => {
      const profile = infoMap.get(s.drepId)!;
      return {
        drepId: s.drepId,
        name: profile.name,
        score: profile.score,
        similarity: Math.round(s.similarity * 100),
        isActive: profile.isActive,
        delegatorCount: profile.delegatorCount,
      };
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cosineDistance(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
