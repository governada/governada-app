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
import { computePassagePrediction, type PassagePredictionInput } from '@/lib/passagePrediction';

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
  },
  [{ cron: '0 */6 * * *' }, { event: 'drepscore/sync.votes' }, { event: 'cc/votes.synced' }],
  async ({ step }) => {
    const enabled = await step.run('check-flag', () => getFeatureFlag('passage_prediction', false));
    if (!enabled) {
      return { status: 'disabled', reason: 'feature_flag_off' };
    }

    const supabase = getSupabaseAdmin();

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

      let updated = 0;

      for (const p of proposals) {
        try {
          // Fetch vote tallies
          const { data: voteSummary } = await supabase
            .from('proposal_voting_summary')
            .select('*')
            .eq('proposal_tx_hash', p.tx_hash)
            .eq('proposal_index', p.proposal_index)
            .maybeSingle();

          // Fetch constitutional score from cache
          const { data: constCache } = await supabase
            .from('proposal_intelligence_cache')
            .select('content')
            .eq('proposal_tx_hash', p.tx_hash)
            .eq('proposal_index', p.proposal_index)
            .eq('section_type', 'constitutional')
            .maybeSingle();

          const constScore = constCache?.content
            ? ((constCache.content as Record<string, unknown>).score as string)
            : null;

          // Fetch citizen sentiment
          const { data: sentiment } = await supabase
            .from('engagement_signal_aggregations')
            .select('data')
            .eq('entity_type', 'proposal')
            .eq('entity_id', `${p.tx_hash}-${p.proposal_index}`)
            .eq('signal_type', 'sentiment')
            .maybeSingle();

          const sentimentData = sentiment?.data as Record<string, unknown> | null;

          const predInput: PassagePredictionInput = {
            proposalType: p.proposal_type,
            drepVotes: {
              yes: (voteSummary?.drep_yes as number) ?? 0,
              no: (voteSummary?.drep_no as number) ?? 0,
              abstain: (voteSummary?.drep_abstain as number) ?? 0,
            },
            spoVotes: {
              yes: (voteSummary?.spo_yes as number) ?? 0,
              no: (voteSummary?.spo_no as number) ?? 0,
              abstain: (voteSummary?.spo_abstain as number) ?? 0,
            },
            ccVotes: {
              yes: (voteSummary?.cc_yes as number) ?? 0,
              no: (voteSummary?.cc_no as number) ?? 0,
              abstain: (voteSummary?.cc_abstain as number) ?? 0,
            },
            constitutionalScore:
              constScore === 'pass' || constScore === 'warning' || constScore === 'fail'
                ? constScore
                : null,
            citizenSentiment: sentimentData
              ? {
                  support: (sentimentData.support as number) ?? 0,
                  oppose: (sentimentData.oppose as number) ?? 0,
                  total: (sentimentData.total as number) ?? 0,
                }
              : null,
            withdrawalAmount: p.withdrawal_amount,
          };

          const prediction = computePassagePrediction(predInput);

          await supabase.from('proposal_intelligence_cache').upsert(
            {
              proposal_tx_hash: p.tx_hash,
              proposal_index: p.proposal_index,
              section_type: 'passage_prediction',
              content: prediction as unknown as Record<string, unknown>,
              content_hash: `votes-${(voteSummary?.drep_yes ?? 0) + (voteSummary?.drep_no ?? 0) + (voteSummary?.spo_yes ?? 0) + (voteSummary?.cc_yes ?? 0)}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'proposal_tx_hash,proposal_index,section_type' },
          );
          updated++;
        } catch (err) {
          logger.error('[passage-predictions] Failed for proposal', {
            txHash: p.tx_hash,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { updated };
    });

    // Log sync
    await step.run('log-sync', async () => {
      await supabase.from('sync_log').insert({
        sync_type: 'passage_predictions',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        success: true,
        details: result,
      });
    });

    logger.info('[passage-predictions] Predictions updated', result);
    return { status: 'completed', ...result };
  },
);
