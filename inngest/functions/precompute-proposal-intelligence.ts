/**
 * Pre-compute Proposal Intelligence
 *
 * Background pipeline that pre-computes shared intelligence sections for open
 * proposals: constitutional check, key questions, and passage predictions.
 * Results are cached in `proposal_intelligence_cache` so reviewers see instant briefs.
 *
 * Triggers:
 *   - Every 4 hours (catch-up for any missed proposals)
 *   - On-demand via event (fired after proposal sync)
 *
 * Each proposal costs ~2 AI calls (constitutional + key questions) + 1 deterministic
 * computation (passage prediction). Batches of 3 to control AI costs.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getFeatureFlag } from '@/lib/featureFlags';
import { runConstitutionalCheck } from '@/lib/ai/shared/constitutionalAnalysis';
import { runResearchPrecedent } from '@/lib/ai/shared/researchPrecedent';
import {
  computePassagePrediction,
  buildPredictionInput,
  fetchPredictionData,
} from '@/lib/passagePrediction';
import { MODELS } from '@/lib/ai';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenProposal {
  tx_hash: string;
  proposal_index: number;
  title: string;
  abstract: string | null;
  proposal_type: string;
  motivation: string | null;
  rationale: string | null;
  withdrawal_amount: number | null;
  meta_json: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Hash helper — determines staleness
// ---------------------------------------------------------------------------

function hashProposalContent(p: OpenProposal): string {
  const input = `${p.title}|${p.abstract ?? ''}|${p.motivation ?? ''}|${p.rationale ?? ''}|${p.proposal_type}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Inngest Function
// ---------------------------------------------------------------------------

export const precomputeProposalIntelligence = inngest.createFunction(
  {
    id: 'precompute-proposal-intelligence',
    name: 'Pre-compute Proposal Intelligence',
    retries: 2,
    concurrency: { limit: 3, scope: 'env', key: '"intel-precompute"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const detail = error instanceof Error ? error.message : String(error);
      logger.error('[precompute-intel] Function failed permanently', { error: detail });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: detail.slice(0, 250),
        })
        .eq('sync_type', 'intelligence_precompute')
        .is('finished_at', null);
    },
    triggers: [{ cron: '30 */4 * * *' }, { event: 'governada/proposal.intelligence.precompute' }],
  },
  async ({ step }) => {
    // Check feature flag
    const enabled = await step.run('check-flag', () =>
      getFeatureFlag('intelligence_precompute', false),
    );
    if (!enabled) {
      return { status: 'disabled', reason: 'feature_flag_off' };
    }

    const supabase = getSupabaseAdmin();
    const syncStartedAt = new Date().toISOString();

    // Step 1: Find proposals needing pre-computation
    const proposals = await step.run('find-proposals-needing-precompute', async () => {
      // Get all open proposals
      const { data: openProposals } = await supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount, meta_json',
        )
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null)
        .not('title', 'is', null);

      if (!openProposals || openProposals.length === 0) return [];

      // Extract motivation/rationale from meta_json
      const enriched: OpenProposal[] = openProposals.map((p) => {
        let motivation: string | null = null;
        let rationale: string | null = null;
        const meta = p.meta_json as Record<string, unknown> | null;
        if (meta) {
          const body = (meta.body ?? meta) as Record<string, unknown>;
          motivation = (body.motivation as string) ?? null;
          rationale = (body.rationale as string) ?? null;
        }
        return { ...p, motivation, rationale };
      });

      // Get existing cache entries
      const txHashes = enriched.map((p) => p.tx_hash);
      const { data: cached } = await supabase
        .from('proposal_intelligence_cache')
        .select('proposal_tx_hash, proposal_index, section_type, content_hash')
        .in('proposal_tx_hash', txHashes);

      // Build a cache map for quick lookup
      const cacheMap = new Map<string, string>();
      for (const c of cached ?? []) {
        const key = `${c.proposal_tx_hash}-${c.proposal_index}-${c.section_type}`;
        cacheMap.set(key, c.content_hash ?? '');
      }

      // Filter to proposals that need work (missing or stale cache)
      const needsWork: OpenProposal[] = [];
      for (const p of enriched) {
        const hash = hashProposalContent(p);
        const constKey = `${p.tx_hash}-${p.proposal_index}-constitutional`;
        const questKey = `${p.tx_hash}-${p.proposal_index}-key_questions`;
        const predKey = `${p.tx_hash}-${p.proposal_index}-passage_prediction`;

        // Needs work if any section is missing or stale
        const constStale = cacheMap.get(constKey) !== hash;
        const questStale = cacheMap.get(questKey) !== hash;
        const predMissing = !cacheMap.has(predKey);

        if (constStale || questStale || predMissing) {
          needsWork.push(p);
        }
      }

      // Limit to 20 per run to control AI costs
      return needsWork.slice(0, 20);
    });

    if (proposals.length === 0) {
      return { status: 'no_work', proposalsChecked: 0 };
    }

    logger.info('[precompute-intel] Processing proposals', { count: proposals.length });

    // Step 2: Pre-compute constitutional checks (batches of 3)
    let constitutionalCount = 0;
    for (let i = 0; i < proposals.length; i += 3) {
      const batch = proposals.slice(i, i + 3);
      const batchNum = Math.floor(i / 3) + 1;

      const batchResult = await step.run(
        `precompute-constitutional-batch-${batchNum}`,
        async () => {
          let count = 0;
          for (const p of batch) {
            try {
              const startMs = Date.now();
              const result = await runConstitutionalCheck({
                title: p.title,
                abstract: p.abstract ?? undefined,
                proposalType: p.proposal_type,
                motivation: p.motivation ?? undefined,
                rationale: p.rationale ?? undefined,
              });
              const generationTimeMs = Date.now() - startMs;

              await supabase.from('proposal_intelligence_cache').upsert(
                {
                  proposal_tx_hash: p.tx_hash,
                  proposal_index: p.proposal_index,
                  section_type: 'constitutional',
                  content: result as unknown as Record<string, unknown>,
                  content_hash: hashProposalContent(p),
                  model_used: MODELS.FAST,
                  generation_time_ms: generationTimeMs,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'proposal_tx_hash,proposal_index,section_type' },
              );
              count++;
            } catch (err) {
              logger.error('[precompute-intel] Constitutional check failed for proposal', {
                txHash: p.tx_hash,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
          return count;
        },
      );
      constitutionalCount += batchResult;
    }

    // Step 3: Pre-compute key questions (batches of 3)
    let keyQuestionsCount = 0;
    for (let i = 0; i < proposals.length; i += 3) {
      const batch = proposals.slice(i, i + 3);
      const batchNum = Math.floor(i / 3) + 1;

      const batchResult = await step.run(`precompute-key-questions-batch-${batchNum}`, async () => {
        let count = 0;
        for (const p of batch) {
          try {
            const startMs = Date.now();
            const result = await runResearchPrecedent({
              proposalTitle: p.title,
              proposalAbstract: p.abstract ?? undefined,
              proposalType: p.proposal_type,
              withdrawalAmount: p.withdrawal_amount ?? undefined,
            });
            const generationTimeMs = Date.now() - startMs;

            await supabase.from('proposal_intelligence_cache').upsert(
              {
                proposal_tx_hash: p.tx_hash,
                proposal_index: p.proposal_index,
                section_type: 'key_questions',
                content: result as unknown as Record<string, unknown>,
                content_hash: hashProposalContent(p),
                model_used: MODELS.FAST,
                generation_time_ms: generationTimeMs,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'proposal_tx_hash,proposal_index,section_type' },
            );
            count++;
          } catch (err) {
            logger.error('[precompute-intel] Key questions failed for proposal', {
              txHash: p.tx_hash,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return count;
      });
      keyQuestionsCount += batchResult;
    }

    // Step 4: Compute passage predictions (deterministic, fast)
    // Uses shared batch-fetch helpers from lib/passagePrediction.ts
    const passagePredictionCount = await step.run('compute-passage-predictions', async () => {
      const { voteMap, constMap, sentimentMap } = await fetchPredictionData(supabase, proposals);

      let count = 0;
      const upsertRows: Array<Record<string, unknown>> = [];

      for (const p of proposals) {
        try {
          const { input: predInput, voteHash } = buildPredictionInput(
            p,
            voteMap,
            constMap,
            sentimentMap,
          );
          const prediction = computePassagePrediction(predInput);

          upsertRows.push({
            proposal_tx_hash: p.tx_hash,
            proposal_index: p.proposal_index,
            section_type: 'passage_prediction',
            content: prediction as unknown as Record<string, unknown>,
            content_hash: voteHash,
            updated_at: new Date().toISOString(),
          });
          count++;
        } catch (err) {
          logger.error('[precompute-intel] Passage prediction failed', {
            txHash: p.tx_hash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (upsertRows.length > 0) {
        await supabase
          .from('proposal_intelligence_cache')
          .upsert(upsertRows, { onConflict: 'proposal_tx_hash,proposal_index,section_type' });
      }

      return count;
    });

    // Step 5: Log sync
    await step.run('log-sync', async () => {
      await supabase.from('sync_log').insert({
        sync_type: 'intelligence_precompute',
        started_at: syncStartedAt,
        finished_at: new Date().toISOString(),
        success: true,
        details: {
          proposals: proposals.length,
          constitutional: constitutionalCount,
          keyQuestions: keyQuestionsCount,
          passagePredictions: passagePredictionCount,
        },
      });
    });

    return {
      status: 'completed',
      proposals: proposals.length,
      constitutional: constitutionalCount,
      keyQuestions: keyQuestionsCount,
      passagePredictions: passagePredictionCount,
    };
  },
);
