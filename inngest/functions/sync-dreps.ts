/**
 * DReps sync — runs every 6 hours, fetches all DReps from Koios and syncs to Supabase.
 *
 * Steps are structured to avoid serializing large data (rawVotesMap, classifiedProposals)
 * across Inngest step boundaries — those objects can exceed the 4MB step output limit.
 *
 *   0. init-sync — create sync_log entry, reset Koios metrics
 *   1. fetch-proposals — fetch + classify governance proposals (non-fatal)
 *      (returns only lightweight proposalContextEntries; classifiedProposals stay in memory)
 *   2. core-sync — fetch DReps, upsert, post-sync (alignment, snapshots, history)
 *      (rawVotesMap never leaves this step)
 *   3. finalize — write sync_log, emit analytics
 *   4. heartbeat + follow-on events
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  phaseFetchProposals,
  phaseFetchDReps,
  phaseUpsertDReps,
  phasePostSync,
  phaseFinalize,
  type UpsertDRepsResult,
  type PostSyncResult,
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
      // Only serializes lightweight proposalContextEntries across step boundary
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

      // Step 2: Core sync — fetch DReps, upsert to DB, run post-sync (alignment, snapshots, history)
      // Combined into a single step so rawVotesMap + classifiedProposals stay in memory
      // and never cross an Inngest step boundary (they can exceed the 4MB output limit).
      const coreSyncResult = await step.run('core-sync', async () => {
        const drepData = await phaseFetchDReps(proposalResult.proposalContextEntries);

        const upsertResult = await phaseUpsertDReps(drepData.dreps, drepData.delegatorCounts);

        const postSyncResult = await phasePostSync(
          drepData.dreps,
          drepData.rawVotesMap,
          proposalResult.classifiedProposals,
          drepData.delegatorCounts,
        );

        // Return only the lightweight summary — not the raw data
        return {
          upsertResult,
          postSyncResult: {
            alignmentComputed: postSyncResult.alignmentComputed,
            delegationSnapshotsInserted: postSyncResult.delegationSnapshotsInserted,
            scoreHistoryInserted: postSyncResult.scoreHistoryInserted,
            errors: postSyncResult.errors,
            durationMs: postSyncResult.durationMs,
          } satisfies PostSyncResult,
          handlesResolved: drepData.handlesResolved,
          fetchErrors: drepData.errors,
          fetchDurationMs: drepData.durationMs,
        };
      });

      // Step 3: Finalize sync_log, emit analytics
      const allErrors = [
        ...proposalResult.errors,
        ...coreSyncResult.fetchErrors,
        ...coreSyncResult.postSyncResult.errors,
      ];
      const phaseTiming: Record<string, number> = {
        step1_proposals_ms: proposalResult.durationMs,
        step2_enrich_ms: coreSyncResult.fetchDurationMs,
        step4_upsert_ms: coreSyncResult.upsertResult.durationMs,
        step56_parallel_ms: coreSyncResult.postSyncResult.durationMs,
      };

      const result = await step.run('finalize', async () => {
        return await phaseFinalize(
          syncLogId,
          startTime,
          coreSyncResult.upsertResult as UpsertDRepsResult,
          coreSyncResult.handlesResolved,
          allErrors,
          phaseTiming,
        );
      });

      // Step 4: Heartbeat
      await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));

      // Step 5: Trigger follow-on syncs (alignment + scoring)
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
