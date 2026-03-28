/**
 * DReps sync — runs every 6 hours, fetches all DReps from Koios and syncs to Supabase.
 *
 * Steps are structured to avoid serializing large data (rawVotesMap, classifiedProposals)
 * across Inngest step boundaries — those objects can exceed the 4MB step output limit.
 *
 *   0. init-sync — create sync_log entry, reset Koios metrics
 *   1. core-sync — fetch proposals, fetch DReps, upsert, post-sync (alignment, snapshots, history)
 *      (classifiedProposals + rawVotesMap never leave this step)
 *   2. finalize — write sync_log, emit analytics
 *   3. heartbeat + follow-on events
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
import { pingHeartbeat, errMsg, capMsg, alertCritical } from '@/lib/sync-utils';
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
      const errorName =
        error && typeof error === 'object'
          ? (error as unknown as Record<string, unknown>).name
          : undefined;
      const detail = msg || errorName || JSON.stringify(error);
      logger.error('[dreps] Function failed permanently', { error: detail });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${detail}`),
        })
        .eq('sync_type', 'dreps')
        .is('finished_at', null);

      // Proactive alerting — notify immediately on any sync failure
      await alertCritical(
        'DRep Sync Failed',
        `sync-dreps failed after all retries.\nError: ${detail}\nCheck Koios API status at https://api.koios.rest/\nStale DRep data may affect GHI scores.`,
      );

      // Escalate on consecutive failures — 3+ failures = 18+ hours stale
      try {
        const { data: recentLogs } = await sb
          .from('sync_log')
          .select('success')
          .eq('sync_type', 'dreps')
          .order('started_at', { ascending: false })
          .limit(5);
        const consecutiveFailures =
          recentLogs?.findIndex((r) => r.success === true) ?? recentLogs?.length ?? 0;
        if (consecutiveFailures >= 3) {
          await alertCritical(
            'CRITICAL: DRep Sync Down 18+ Hours',
            `${consecutiveFailures} consecutive DRep sync failures.\nDRep data is ${consecutiveFailures * 6}+ hours stale.\nGHI DRep Participation component is reading stale data.\nImmediate investigation required:\n1) Koios API status\n2) sync_log error patterns\n3) GHI snapshot accuracy`,
          );
        }
      } catch {
        // Don't let escalation logic crash the onFailure handler
      }
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

      // Step 1: Core sync — fetch proposals + DReps, upsert, post-sync (alignment, snapshots, history)
      // All large data (classifiedProposals, rawVotesMap) stays in memory within this step
      // and never crosses an Inngest step boundary (they can exceed the 4MB output limit).
      const coreSyncResult = await step.run('core-sync', async () => {
        // Fetch + classify proposals (non-fatal)
        let proposalResult;
        try {
          proposalResult = await phaseFetchProposals();
        } catch (err) {
          logger.error('[dreps] Proposal fetch failed (non-fatal)', { error: err });
          proposalResult = {
            classifiedProposals: [],
            proposalContextEntries: [],
            errors: [errMsg(err)],
            durationMs: 0,
          };
        }

        const drepData = await phaseFetchDReps(proposalResult.proposalContextEntries);

        const upsertResult = await phaseUpsertDReps(drepData.dreps, drepData.delegatorCounts);

        const postSyncResult = await phasePostSync(
          drepData.dreps,
          drepData.rawVotesMap,
          proposalResult.classifiedProposals,
          drepData.delegatorCounts,
        );

        // Return only the lightweight summary — not the raw data.
        // Cap error arrays to prevent Inngest output_too_large failures.
        const MAX_ERRORS = 20;
        return {
          upsertResult,
          postSyncResult: {
            alignmentComputed: postSyncResult.alignmentComputed,
            delegationSnapshotsInserted: postSyncResult.delegationSnapshotsInserted,
            scoreHistoryInserted: postSyncResult.scoreHistoryInserted,
            errors: postSyncResult.errors.slice(0, MAX_ERRORS),
            durationMs: postSyncResult.durationMs,
          } satisfies PostSyncResult,
          handlesResolved: drepData.handlesResolved,
          proposalErrors: proposalResult.errors.slice(0, MAX_ERRORS),
          proposalDurationMs: proposalResult.durationMs,
          fetchErrors: drepData.errors.slice(0, MAX_ERRORS),
          fetchDurationMs: drepData.durationMs,
        };
      });

      // Step 2: Finalize sync_log, emit analytics
      const allErrors = [
        ...coreSyncResult.proposalErrors,
        ...coreSyncResult.fetchErrors,
        ...coreSyncResult.postSyncResult.errors,
      ];
      const phaseTiming: Record<string, number> = {
        step1_proposals_ms: coreSyncResult.proposalDurationMs,
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
