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
  listOpenProposalIntelligenceTargets,
  refreshPassagePredictionCache,
} from '@/lib/intelligence/proposalIntelligenceCache';

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
      { cron: '40 */6 * * *' }, // Offset to :40 to avoid :00 collision
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
      const proposals = await listOpenProposalIntelligenceTargets(supabase);
      if (proposals.length === 0) {
        return { updated: 0 };
      }

      const updated = await refreshPassagePredictionCache(supabase, proposals, {
        nowIso: new Date().toISOString(),
        onError: (proposal, error) => {
          logger.error('[passage-predictions] Failed for proposal', {
            txHash: proposal.tx_hash,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      });

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
