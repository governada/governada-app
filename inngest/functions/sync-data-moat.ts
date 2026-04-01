/**
 * Data Moat Collection — runs daily, collects historical governance data
 * that compounds over time and becomes impossible for competitors to replicate.
 *
 * Streams (each as a separate Inngest step for durability):
 * 1. Delegator Snapshots (per-epoch delegation distribution) — chunked to avoid timeout
 * 2. DRep Lifecycle Events (registration, updates, retirements)
 * 3. Epoch Governance Summaries (aggregate per-epoch stats)
 * 4. Committee Members (CC membership and terms)
 * 5. Metadata Archive (persistent CIP-119/108/136 blobs)
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { alertCritical, emitPostHog, errMsg, capMsg, SyncLogger } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';
import {
  prepareDelegatorSnapshot,
  syncDelegatorSnapshotChunk,
  finalizeDelegatorSnapshot,
  syncDRepLifecycleEvents,
  syncEpochGovernanceSummaries,
  syncCommitteeMembers,
  syncMetadataArchive,
} from '@/lib/sync/data-moat';

const DELEGATOR_CHUNK_SIZE = 100;

export const syncDataMoat = inngest.createFunction(
  {
    id: 'sync-data-moat',
    retries: 2,
    concurrency: [
      { limit: 1, scope: 'env', key: '"data-moat"' },
      { limit: 2, scope: 'env', key: '"koios-global"' }, // Global Koios rate limit guard
    ],
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[data-moat] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'data_moat')
        .is('finished_at', null);
    },
    triggers: [{ cron: '15 3 * * *' }, { event: 'drepscore/sync.data-moat' }],
  },
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-data-moat', '15 3 * * *');
    try {
      // Step 1: Prepare delegator snapshot — check coverage, get remaining DRep IDs
      const prep = await step.run('prepare-delegator-snapshot', async () => {
        try {
          return await prepareDelegatorSnapshot();
        } catch (err) {
          logger.error('[data-moat] Delegator snapshot prep failed', { error: err });
          return null;
        }
      });

      // Step 1b: Process delegators in chunks (each step < 60s)
      let totalProcessed = 0;
      let totalSnapshotted = 0;
      const delegatorErrors: string[] = [];

      if (prep) {
        const chunks: string[][] = [];
        for (let i = 0; i < prep.drepIds.length; i += DELEGATOR_CHUNK_SIZE) {
          chunks.push(prep.drepIds.slice(i, i + DELEGATOR_CHUNK_SIZE));
        }

        for (let ci = 0; ci < chunks.length; ci++) {
          const chunkResult = await step.run(`snapshot-delegators-${ci}`, async () => {
            try {
              return await syncDelegatorSnapshotChunk(chunks[ci], prep.epoch);
            } catch (err) {
              logger.error(`[data-moat] Delegator chunk ${ci} failed`, { error: err });
              return { drepsProcessed: 0, delegatorsSnapshotted: 0, errors: [errMsg(err)] };
            }
          });
          totalProcessed += chunkResult.drepsProcessed;
          totalSnapshotted += chunkResult.delegatorsSnapshotted;
          delegatorErrors.push(...chunkResult.errors);
        }

        // Step 1c: Finalize — write sync_log and completeness
        await step.run('finalize-delegator-snapshot', async () => {
          await finalizeDelegatorSnapshot(
            prep.epoch,
            totalProcessed,
            totalSnapshotted,
            delegatorErrors,
          );
        });
      } else {
        // Coverage already sufficient — still write sync_log so health checks
        // don't report delegator_snapshots as permanently stale
        await step.run('finalize-delegator-snapshot-noop', async () => {
          const sb = getSupabaseAdmin();
          const syncLog = new SyncLogger(sb, 'delegator_snapshots');
          await syncLog.start();
          await syncLog.finalize(true, null, { skipped: true, reason: 'coverage_sufficient' });
        });
      }

      const delegatorResult = {
        drepsProcessed: totalProcessed,
        delegatorsSnapshotted: totalSnapshotted,
        errors: delegatorErrors,
      };

      // Step 2: DRep lifecycle events — incremental, only new events
      const lifecycleResult = await step.run('sync-lifecycle-events', async () => {
        try {
          return await syncDRepLifecycleEvents();
        } catch (err) {
          logger.error('[data-moat] Lifecycle events failed', { error: err });
          return { eventsStored: 0, drepsProcessed: 0, errors: [errMsg(err)] };
        }
      });

      // Step 3: Epoch governance summaries — lightweight, always runs
      const epochResult = await step.run('sync-epoch-summaries', async () => {
        try {
          return await syncEpochGovernanceSummaries();
        } catch (err) {
          logger.error('[data-moat] Epoch summaries failed', { error: err });
          return { epochsStored: 0, errors: [errMsg(err)] };
        }
      });

      // Step 4: Committee members — very lightweight
      const committeeResult = await step.run('sync-committee-members', async () => {
        try {
          return await syncCommitteeMembers();
        } catch (err) {
          logger.error('[data-moat] Committee sync failed', { error: err });
          return { membersStored: 0, errors: [errMsg(err)] };
        }
      });

      // Step 5: Metadata archive — archives current metadata blobs
      const metadataResult = await step.run('archive-metadata', async () => {
        try {
          return await syncMetadataArchive();
        } catch (err) {
          logger.error('[data-moat] Metadata archive failed', { error: err });
          return {
            drepMetadataArchived: 0,
            proposalMetadataArchived: 0,
            rationaleMetadataArchived: 0,
            errors: [errMsg(err)],
          };
        }
      });

      // Emit analytics + alert on failures
      await step.run('emit-analytics', async () => {
        const allErrors = [
          ...delegatorResult.errors,
          ...lifecycleResult.errors,
          ...epochResult.errors,
          ...committeeResult.errors,
          ...metadataResult.errors,
        ];

        await emitPostHog(allErrors.length === 0, 'data_moat', 0, {
          delegators_snapshotted: delegatorResult.delegatorsSnapshotted,
          dreps_processed: delegatorResult.drepsProcessed,
          lifecycle_events: lifecycleResult.eventsStored,
          epochs_stored: epochResult.epochsStored,
          committee_members: committeeResult.membersStored,
          drep_metadata_archived: metadataResult.drepMetadataArchived,
          proposal_metadata_archived: metadataResult.proposalMetadataArchived,
          rationale_metadata_archived: metadataResult.rationaleMetadataArchived,
          error_count: allErrors.length,
        });

        if (allErrors.length > 0) {
          await alertCritical(
            'Data Moat Sync Failures',
            `${allErrors.length} error(s):\n${allErrors.join('\n')}`,
          );
        }
      });

      cronCheckOut('sync-data-moat', checkInId, true);
      return {
        delegators: delegatorResult,
        lifecycle: lifecycleResult,
        epochs: epochResult,
        committee: committeeResult,
        metadata: metadataResult,
      };
    } catch (error) {
      cronCheckOut('sync-data-moat', checkInId, false);
      throw error;
    }
  },
);
