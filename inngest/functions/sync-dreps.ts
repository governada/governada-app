/**
 * DReps sync — runs every 6 hours, fetches all DReps from Koios and syncs to Supabase.
 *
 * Split into granular Inngest steps to stay under Cloudflare's 100s timeout:
 *   0. init-sync — create sync_log entry, reset Koios metrics
 *   1. fetch-proposals — fetch + classify governance proposals (non-fatal)
 *   2. fetch-dreps — fetch enriched DReps from Koios, resolve handles, read delegator counts
 *   3. upsert-dreps — batch upsert DRep rows to Supabase
 *   4. post-sync — alignment scores, delegation snapshots, score history
 *   5. finalize — write sync_log, emit analytics
 *   6. heartbeat + follow-on events
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  phaseFetchProposals,
  phaseFetchDReps,
  phaseUpsertDReps,
  phasePostSync,
  phaseFinalize,
} from '@/lib/sync/dreps';
import { pingHeartbeat, errMsg, capMsg } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';
import { logger } from '@/lib/logger';
import { resetKoiosMetrics } from '@/utils/koios';

export const syncDreps = inngest.createFunction(
  {
    id: 'sync-dreps',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[dreps] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'dreps')
        .is('finished_at', null);
    },
  },
  [{ cron: '0 */6 * * *' }, { event: 'drepscore/sync.dreps' }],
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-dreps', '0 */6 * * *');
    try {
      // Step 0: Initialize sync_log and reset metrics
      const { syncLogId, startTime } = await step.run('init-sync', async () => {
        resetKoiosMetrics();
        const sb = getSupabaseAdmin();
        const { data: logRow } = await sb
          .from('sync_log')
          .insert({
            sync_type: 'dreps',
            started_at: new Date().toISOString(),
            success: false,
          })
          .select('id')
          .single();
        return { syncLogId: logRow?.id ?? null, startTime: Date.now() };
      });

      // Step 1: Fetch + classify proposals (non-fatal)
      const proposalResult = await step.run('fetch-proposals', async () => {
        try {
          return await phaseFetchProposals();
        } catch (err) {
          logger.error('[dreps] Proposal fetch step failed', { error: err });
          return {
            classifiedProposals: [],
            proposalContextEntries: [],
            errors: [errMsg(err)],
            durationMs: 0,
          };
        }
      });

      // Step 2: Fetch enriched DReps + resolve handles + read delegator counts
      const drepData = await step.run('fetch-dreps', async () => {
        return await phaseFetchDReps(proposalResult.proposalContextEntries);
      });

      // Step 3: Upsert DRep rows to Supabase
      const upsertResult = await step.run('upsert-dreps', async () => {
        return await phaseUpsertDReps(drepData.dreps, drepData.delegatorCounts);
      });

      // Step 4: Alignment scores, delegation snapshots, score history
      const postSyncResult = await step.run('post-sync', async () => {
        return await phasePostSync(
          drepData.dreps,
          drepData.rawVotesMap,
          proposalResult.classifiedProposals,
          drepData.delegatorCounts,
        );
      });

      // Step 5: Finalize sync_log, emit analytics
      const allErrors = [...proposalResult.errors, ...drepData.errors, ...postSyncResult.errors];
      const phaseTiming: Record<string, number> = {
        step1_proposals_ms: proposalResult.durationMs,
        step2_enrich_ms: drepData.durationMs,
        step4_upsert_ms: upsertResult.durationMs,
        step56_parallel_ms: postSyncResult.durationMs,
      };

      const result = await step.run('finalize', async () => {
        return await phaseFinalize(
          syncLogId,
          startTime,
          upsertResult,
          drepData.handlesResolved,
          allErrors,
          phaseTiming,
        );
      });

      // Step 6: Heartbeat
      await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));

      // Step 7: Trigger follow-on syncs (alignment + scoring)
      await step.sendEvent('trigger-follow-on-syncs', [
        {
          name: 'drepscore/sync.alignment',
          data: { triggeredBy: 'sync-dreps' },
        },
        {
          name: 'drepscore/sync.scores',
          data: { triggeredBy: 'sync-dreps' },
        },
      ]);

      cronCheckOut('sync-dreps', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('sync-dreps', checkInId, false);
      throw error;
    }
  },
);
