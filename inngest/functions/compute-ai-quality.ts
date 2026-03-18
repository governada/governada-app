/**
 * Compute AI Quality — Inngest cron function.
 *
 * Runs every 12 hours. Computes cross-proposal quality metrics:
 * 1. Originality scores for all proposal drafts (compare each vs published proposals)
 * 2. Homogenization detection (compare AI-assisted vs non-AI clustering)
 *
 * Gated behind `embedding_ai_quality` feature flag.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import { computeOriginality, detectHomogenization } from '@/lib/workspace/aiQuality';

export const computeAiQuality = inngest.createFunction(
  {
    id: 'compute-ai-quality',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"ai-quality"' },
  },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    // Step 1: Check feature flag
    const enabled = await step.run('check-flag', async () => {
      return getFeatureFlag('embedding_ai_quality', false);
    });

    if (!enabled) return { skipped: true, reason: 'feature flag disabled' };

    // Step 2: Compute originality scores for all proposal drafts
    const originalityResult = await step.run('compute-originality', async () => {
      const supabase = getSupabaseAdmin();

      // Get all published proposal embeddings (the corpus)
      const { data: publishedEmbeddings } = await supabase
        .from('embeddings')
        .select('entity_id, embedding')
        .eq('entity_type', 'proposal')
        .limit(500);

      if (!publishedEmbeddings?.length) {
        return { updated: 0, reason: 'no published proposal embeddings' };
      }

      const corpus = publishedEmbeddings.map(
        (e) =>
          (typeof e.embedding === 'string' ? JSON.parse(e.embedding) : e.embedding) as number[],
      );

      // Get all draft embeddings
      const { data: draftEmbeddings } = await supabase
        .from('embeddings')
        .select('entity_id, embedding')
        .eq('entity_type', 'proposal_draft')
        .limit(500);

      if (!draftEmbeddings?.length) {
        return { updated: 0, reason: 'no draft embeddings' };
      }

      let updated = 0;

      for (const draft of draftEmbeddings) {
        const embedding = (
          typeof draft.embedding === 'string' ? JSON.parse(draft.embedding) : draft.embedding
        ) as number[];

        const originality = computeOriginality(embedding, corpus);

        const { error } = await supabase
          .from('proposal_drafts')
          .update({ ai_originality_score: originality })
          .eq('id', draft.entity_id);

        if (!error) updated++;
      }

      return { updated, totalDrafts: draftEmbeddings.length };
    });

    // Step 3: Compute homogenization metrics
    const homogenizationResult = await step.run('compute-homogenization', async () => {
      const supabase = getSupabaseAdmin();

      // Get draft IDs that have been AI-assisted (ai_influence_score > 0)
      const { data: aiDrafts } = await supabase
        .from('proposal_drafts')
        .select('id')
        .gt('ai_influence_score', 0)
        .limit(500);

      const { data: nonAiDrafts } = await supabase
        .from('proposal_drafts')
        .select('id')
        .or('ai_influence_score.is.null,ai_influence_score.eq.0')
        .limit(500);

      const aiDraftIds = new Set((aiDrafts ?? []).map((d) => d.id));
      const nonAiDraftIds = new Set((nonAiDrafts ?? []).map((d) => d.id));

      // Get embeddings for both groups
      const { data: allDraftEmbeddings } = await supabase
        .from('embeddings')
        .select('entity_id, embedding')
        .eq('entity_type', 'proposal_draft')
        .limit(1000);

      if (!allDraftEmbeddings?.length) {
        return { computed: false, reason: 'no draft embeddings' };
      }

      const aiEmbeddings: number[][] = [];
      const nonAiEmbeddings: number[][] = [];

      for (const row of allDraftEmbeddings) {
        const embedding = (
          typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding
        ) as number[];

        if (aiDraftIds.has(row.entity_id)) {
          aiEmbeddings.push(embedding);
        } else if (nonAiDraftIds.has(row.entity_id)) {
          nonAiEmbeddings.push(embedding);
        }
      }

      if (aiEmbeddings.length < 2 || nonAiEmbeddings.length < 2) {
        return {
          computed: false,
          reason: 'insufficient data for comparison',
          aiCount: aiEmbeddings.length,
          nonAiCount: nonAiEmbeddings.length,
        };
      }

      const metrics = detectHomogenization(aiEmbeddings, nonAiEmbeddings);

      logger.info('[compute-ai-quality] Homogenization analysis', {
        aiClusterTightness: metrics.aiClusterTightness,
        nonAiClusterTightness: metrics.nonAiClusterTightness,
        homogenizationRisk: metrics.homogenizationRisk,
        aiCount: aiEmbeddings.length,
        nonAiCount: nonAiEmbeddings.length,
      });

      return {
        computed: true,
        ...metrics,
        aiCount: aiEmbeddings.length,
        nonAiCount: nonAiEmbeddings.length,
      };
    });

    logger.info('[compute-ai-quality] Batch complete', {
      originality: originalityResult,
      homogenization: homogenizationResult,
    });

    return {
      originality: originalityResult,
      homogenization: homogenizationResult,
    };
  },
);
