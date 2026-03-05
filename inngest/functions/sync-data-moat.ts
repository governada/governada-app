/**
 * Data Moat Collection — runs daily, collects historical governance data
 * that compounds over time and becomes impossible for competitors to replicate.
 *
 * Streams (each as a separate Inngest step for durability):
 * 1. Delegator Snapshots (per-epoch delegation distribution)
 * 2. DRep Lifecycle Events (registration, updates, retirements)
 * 3. Epoch Governance Summaries (aggregate per-epoch stats)
 * 4. Committee Members (CC membership and terms)
 * 5. Metadata Archive (persistent CIP-119/108/136 blobs)
 */

import { inngest } from '@/lib/inngest';
import { logger } from '@/lib/logger';
import { emitPostHog, errMsg } from '@/lib/sync-utils';
import {
  syncDelegatorSnapshots,
  syncDRepLifecycleEvents,
  syncEpochGovernanceSummaries,
  syncCommitteeMembers,
  syncMetadataArchive,
} from '@/lib/sync/data-moat';

export const syncDataMoat = inngest.createFunction(
  {
    id: 'sync-data-moat',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"data-moat"' },
  },
  [{ cron: '15 3 * * *' }, { event: 'drepscore/sync.data-moat' }],
  async ({ step }) => {
    // Step 1: Delegator snapshots — highest value, most data
    const delegatorResult = await step.run('snapshot-delegators', async () => {
      try {
        return await syncDelegatorSnapshots();
      } catch (err) {
        logger.error('[data-moat] Delegator snapshots failed', { error: err });
        return { drepsProcessed: 0, delegatorsSnapshotted: 0, errors: [errMsg(err)] };
      }
    });

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

    // Emit analytics
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
    });

    return {
      delegators: delegatorResult,
      lifecycle: lifecycleResult,
      epochs: epochResult,
      committee: committeeResult,
      metadata: metadataResult,
    };
  },
);
