/**
 * Update Passage Predictions
 *
 * Recomputes passage predictions for all open proposals after new votes
 * are synced. This is a lightweight, deterministic function (no AI calls).
 *
 * Triggers:
 *   - After vote sync completes (drepscore/sync.votes event + SPO/CC vote sync)
 *   - Every 6 hours as a catch-up
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { getFeatureFlag } from '@/lib/featureFlags';
import {
  computePassagePrediction,
  buildPredictionInput,
  fetchPredictionData,
} from '@/lib/passagePrediction';

export const updatePassagePredictions = inngest.createFunction(
  {
    id: 'update-passage-predictions',
    name: 'Update Passage Predictions',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"passage-predictions"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const detail = error instanceof Error ? error.message : String(error);
      logger.error('[passage-predictions] Function failed permanently', { error: detail });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: detail.slice(0, 250),
        })
        .eq('sync_type', 'passage_predictions')
        .is('finished_at', null);
    },
    triggers: [
      { cron: '0 */6 * * *' },
      { event: 'drepscore/sync.votes' },
      { event: 'cc/votes.synced' },
    ],
  },
  async ({ step }) => {
    const enabled = await step.run('check-flag', () => getFeatureFlag('passage_prediction', false));
    if (!enabled) {
      return { status: 'disabled', reason: 'feature_flag_off' };
    }

    const supabase = getSupabaseAdmin();
    const syncStartedAt = new Date().toISOString();

    const result = await step.run('recompute-predictions', async () => {
      // Get all open proposals
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, proposal_type, withdrawal_amount')
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null)
        .not('title', 'is', null);

      if (!proposals || proposals.length === 0) {
        return { updated: 0 };
      }

      // Batch-fetch all supporting data
      const { voteMap, constMap, sentimentMap } = await fetchPredictionData(supabase, proposals);

      let updated = 0;
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
          updated++;
        } catch (err) {
          logger.error('[passage-predictions] Failed for proposal', {
            txHash: p.tx_hash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Batch upsert all predictions
      if (upsertRows.length > 0) {
        await supabase
          .from('proposal_intelligence_cache')
          .upsert(upsertRows, { onConflict: 'proposal_tx_hash,proposal_index,section_type' });
      }

      return { updated };
    });

    // Log sync
    await step.run('log-sync', async () => {
      await supabase.from('sync_log').insert({
        sync_type: 'passage_predictions',
        started_at: syncStartedAt,
        finished_at: new Date().toISOString(),
        success: true,
        details: result,
      });
    });

    logger.info('[passage-predictions] Predictions updated', result);
    return { status: 'completed', ...result };
  },
);
