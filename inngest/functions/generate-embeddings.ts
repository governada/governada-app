/**
 * Batch Embedding Generation — Inngest cron function.
 *
 * Runs every 6 hours. Generates embeddings for:
 * 1. Proposals (title + abstract + type + AI summary)
 * 2. Rationales (vote direction + rationale text + context)
 * 3. DRep profiles (objectives + motivations + alignment + sample rationales)
 *
 * Then precomputes proposal-proposal similarity cache (top 5 per proposal).
 *
 * Gated behind `semantic_embeddings` feature flag.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import { composeProposal, composeRationale, composeDrepProfile } from '@/lib/embeddings/compose';
import { generateAndStoreEmbeddings } from '@/lib/embeddings/generate';

export const generateEmbeddings = inngest.createFunction(
  {
    id: 'generate-embeddings',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"embeddings"' },
    triggers: [{ cron: '55 */6 * * *' }, { event: 'app/generate-embeddings' }], // Offset to :55 to avoid :00 collision
  },
  async ({ step }) => {
    // Step 1: Check feature flag
    const enabled = await step.run('check-flag', async () => {
      return getFeatureFlag('semantic_embeddings', false);
    });

    if (!enabled) return { skipped: true, reason: 'feature flag disabled' };

    // Step 2: Generate proposal embeddings
    const proposalResult = await step.run('embed-proposals', async () => {
      const supabase = getSupabaseAdmin();

      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, abstract, proposal_type, ai_summary')
        .not('title', 'is', null)
        .limit(500);

      if (!proposals?.length) {
        logger.warn('[generate-embeddings] embed-proposals: query returned 0 rows');
        return { generated: 0, total: 0 };
      }

      const documents = proposals
        .map((p) =>
          composeProposal({
            tx_hash: p.tx_hash,
            index: p.proposal_index,
            title: p.title,
            abstract: p.abstract,
            proposal_type: p.proposal_type,
            ai_summary: p.ai_summary,
          }),
        )
        .filter((d) => d.text.length > 20);

      const generated = await generateAndStoreEmbeddings(documents);
      return { generated, total: documents.length };
    });

    // Step 3: Generate rationale embeddings — chunked to avoid Railway timeout.
    // 3,567 rationales split into chunks of 700 (~30s per chunk max).
    const RATIONALE_CHUNK = 200;
    const rationaleChunkResults: { generated: number; total: number }[] = [];

    for (let chunk = 0; chunk * RATIONALE_CHUNK < 4200; chunk++) {
      const from = chunk * RATIONALE_CHUNK;
      const to = from + RATIONALE_CHUNK - 1;

      const chunkResult = await step.run(`embed-rationales-${chunk}`, async () => {
        const supabase = getSupabaseAdmin();

        const { data: rationales } = await supabase
          .from('vote_rationales')
          .select('vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, rationale_text')
          .not('rationale_text', 'is', null)
          .range(from, to);

        if (!rationales?.length) return { generated: 0, total: 0 };

        // Get proposal titles/types for context
        const proposalKeys = [...new Set(rationales.map((r) => r.proposal_tx_hash))];
        const { data: proposals } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title, proposal_type')
          .in('tx_hash', proposalKeys);

        const proposalMap = new Map<
          string,
          {
            tx_hash: string;
            proposal_index: number;
            title: string | null;
            proposal_type: string | null;
          }
        >((proposals ?? []).map((p) => [`${p.tx_hash}:${p.proposal_index}`, p]));

        const { data: votes } = await supabase
          .from('drep_votes')
          .select('drep_id, proposal_tx_hash, proposal_index, vote')
          .in('proposal_tx_hash', proposalKeys);

        const voteMap = new Map<string, string>(
          (votes ?? []).map((v) => [
            `${v.drep_id}:${v.proposal_tx_hash}:${v.proposal_index}`,
            v.vote as string,
          ]),
        );

        const voterIds = [...new Set(rationales.map((r) => r.drep_id))];
        const { data: dreps } = await supabase.from('dreps').select('id, name').in('id', voterIds);
        const drepNameMap = new Map<string, string | null>(
          (dreps ?? []).map((d) => [d.id, d.name]),
        );

        const documents = rationales
          .map((r) => {
            const proposal = proposalMap.get(`${r.proposal_tx_hash}:${r.proposal_index}`);
            const voteDirection = voteMap.get(
              `${r.drep_id}:${r.proposal_tx_hash}:${r.proposal_index}`,
            );
            return composeRationale({
              tx_hash: r.vote_tx_hash,
              index: r.proposal_index ?? 0,
              voter_id: r.drep_id,
              rationale_text: r.rationale_text,
              vote_direction: voteDirection ?? null,
              proposal_title: proposal?.title ?? null,
              proposal_type: proposal?.proposal_type ?? null,
              drep_name: drepNameMap.get(r.drep_id) ?? null,
            });
          })
          .filter((d): d is NonNullable<typeof d> => d !== null && d.text.length > 20);

        const generated = await generateAndStoreEmbeddings(documents);
        return { generated, total: documents.length };
      });

      rationaleChunkResults.push(chunkResult);
      // Stop early if chunk returned fewer rows than requested (end of table)
      if (chunkResult.total < RATIONALE_CHUNK) break;
    }

    const rationaleResult = rationaleChunkResults.reduce(
      (acc, r) => ({ generated: acc.generated + r.generated, total: acc.total + r.total }),
      { generated: 0, total: 0 },
    );

    // Step 4: Generate DRep profile embeddings
    // DRep objectives/motivations live in metadata JSONB (CIP-100), not top-level columns
    const drepResult = await step.run('embed-drep-profiles', async () => {
      const supabase = getSupabaseAdmin();

      const { data: dreps } = await supabase
        .from('dreps')
        .select('id, metadata')
        .not('metadata', 'is', null)
        .limit(500);

      if (!dreps?.length) {
        logger.warn('[generate-embeddings] embed-drep-profiles: query returned 0 rows');
        return { generated: 0, total: 0 };
      }

      const documents = dreps
        .map((d) => {
          const meta = d.metadata as Record<string, unknown> | null;
          const objectives = (meta?.objectives as string) ?? null;
          const motivations = (meta?.motivations as string) ?? null;
          if (!objectives && !motivations) return null;

          return composeDrepProfile({
            drep_id: d.id,
            name: null,
            objectives,
            motivations,
            alignment_narrative: null,
            personality_label: null,
          });
        })
        .filter((d): d is NonNullable<typeof d> => d !== null && d.text.length > 20);

      if (!documents.length) {
        logger.warn(
          '[generate-embeddings] embed-drep-profiles: no DReps with objectives/motivations',
        );
        return { generated: 0, total: 0 };
      }

      const generated = await generateAndStoreEmbeddings(documents);
      return { generated, total: documents.length };
    });

    // Step 5: Precompute proposal-proposal similarity cache
    const cacheResult = await step.run('precompute-similarity-cache', async () => {
      const supabase = getSupabaseAdmin();

      // Get all proposal embeddings
      const { data: proposalEmbeddings } = await supabase
        .from('embeddings')
        .select('entity_id, embedding')
        .eq('entity_type', 'proposal')
        .limit(500);

      if (!proposalEmbeddings?.length || proposalEmbeddings.length < 2) {
        return { cached: 0 };
      }

      let cached = 0;

      // For each proposal, find top 5 most similar proposals via RPC
      for (const pe of proposalEmbeddings) {
        const { data: similar } = await supabase.rpc('match_embeddings', {
          query_embedding: pe.embedding,
          match_entity_type: 'proposal',
          match_threshold: 0.3,
          match_count: 6, // +1 because it includes itself
          filter_metadata: null,
        });

        if (!similar?.length) continue;

        // Filter out self-match and take top 5
        const matches = similar
          .filter((s: { entity_id: string }) => s.entity_id !== pe.entity_id)
          .slice(0, 5);

        for (const match of matches) {
          const row = {
            source_entity_type: 'proposal',
            source_entity_id: pe.entity_id,
            target_entity_type: 'proposal',
            target_entity_id: match.entity_id,
            similarity: match.similarity,
            computed_at: new Date().toISOString(),
          };

          // Upsert (the table has a unique constraint)
          await supabase.from('semantic_similarity_cache').upsert(row, {
            onConflict: 'source_entity_type,source_entity_id,target_entity_type,target_entity_id',
          });
          cached++;
        }
      }

      return { cached };
    });

    logger.info('[generate-embeddings] Batch complete', {
      proposals: proposalResult,
      rationales: rationaleResult,
      dreps: drepResult,
      cache: cacheResult,
    });

    return {
      proposals: proposalResult,
      rationales: rationaleResult,
      dreps: drepResult,
      cache: cacheResult,
    };
  },
);
