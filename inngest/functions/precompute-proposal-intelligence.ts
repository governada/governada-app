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
  findProposalsNeedingIntelligencePrecompute,
  refreshPassagePredictionCache,
  type ProposalIntelligenceTarget,
  upsertProposalIntelligenceSection,
} from '@/lib/intelligence/proposalIntelligenceCache';
import { MODELS } from '@/lib/ai';
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
    const proposals = await step.run('find-proposals-needing-precompute', async () =>
      findProposalsNeedingIntelligencePrecompute(supabase, 20),
    );

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

              await upsertProposalIntelligenceSection(supabase, {
                proposalTxHash: p.tx_hash,
                proposalIndex: p.proposal_index,
                sectionType: 'constitutional',
                content: result as unknown as Record<string, unknown>,
                contentHash: p.contentHash,
                modelUsed: MODELS.FAST,
                generationTimeMs,
              });
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

            await upsertProposalIntelligenceSection(supabase, {
              proposalTxHash: p.tx_hash,
              proposalIndex: p.proposal_index,
              sectionType: 'key_questions',
              content: result as unknown as Record<string, unknown>,
              contentHash: p.contentHash,
              modelUsed: MODELS.FAST,
              generationTimeMs,
            });
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

    const passagePredictionCount = await step.run('compute-passage-predictions', async () => {
      return refreshPassagePredictionCache(
        supabase,
        proposals.map((proposal: ProposalIntelligenceTarget) => ({
          tx_hash: proposal.tx_hash,
          proposal_index: proposal.proposal_index,
          proposal_type: proposal.proposal_type,
          withdrawal_amount: proposal.withdrawal_amount,
          param_changes: proposal.param_changes,
        })),
        {
          onError: (proposal, error) => {
            logger.error('[precompute-intel] Passage prediction failed', {
              txHash: proposal.tx_hash,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        },
      );
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
