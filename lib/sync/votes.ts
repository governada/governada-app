import { blockTimeToEpoch } from '@/lib/koios';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { fetchAllVotesBulk, resetKoiosMetrics, getKoiosMetrics } from '@/utils/koios';
import {
  SyncLogger,
  batchUpsert,
  errMsg,
  emitPostHog,
  triggerAnalyticsDeploy,
  alertDiscord,
  fetchAll,
} from '@/lib/sync-utils';
import { KoiosVoteListSchema, validateArray } from '@/utils/koios-schemas';
import { getSyncCursorBlockTime, setSyncCursorBlockTime } from '@/lib/sync/cursors';
import { dedupeLatestVotesByProposal, normalizeVoteMapForStorage } from '@/lib/drep-votes';
import { planVoteRationaleUpserts, type ExistingVoteRationaleRow } from '@/lib/vote-rationales';
import * as Sentry from '@sentry/nextjs';

const VOTE_CURSOR_SYNC_TYPE = 'votes';
const VOTE_SYNC_OVERLAP_SECONDS = 60 * 60;

/**
 * Core votes sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeVotesSync(): Promise<Record<string, unknown>> {
  return Sentry.startSpan({ name: 'sync.votes', op: 'task' }, async () => {
    const supabase = getSupabaseAdmin();
    const syncLog = new SyncLogger(supabase, 'votes');
    await syncLog.start();
    resetKoiosMetrics();

    let votesSynced = 0;
    let reconciled = 0;
    let rationaleRowsPlanned = 0;
    let rationaleRowsUpserted = 0;
    let voteUpsertErrors = 0;

    try {
      const cursorBlockTime = await getSyncCursorBlockTime(supabase, VOTE_CURSOR_SYNC_TYPE);
      const sinceBlockTime =
        cursorBlockTime === null ? null : Math.max(0, cursorBlockTime - VOTE_SYNC_OVERLAP_SECONDS);

      const bulkVotesMap = await fetchAllVotesBulk({ sinceBlockTime });
      const totalVotes = Object.values(bulkVotesMap).reduce((sum, v) => sum + v.length, 0);
      logger.info('[VoteSync] Bulk votes fetched', {
        totalVotes,
        drepCount: Object.keys(bulkVotesMap).length,
        sinceBlockTime,
      });

      const { voteRows, rationaleRows, maxBlockTime } = normalizeVoteMapForStorage(
        bulkVotesMap,
        (vote) => (vote.block_time ? blockTimeToEpoch(vote.block_time) : null),
      );

      const dedupedVoteRows = [...new Map(voteRows.map((row) => [row.vote_tx_hash, row])).values()];
      const dedupedRationaleRows = [
        ...new Map(rationaleRows.map((row) => [row.vote_tx_hash, row])).values(),
      ];
      let validationErrors = 0;

      const { valid: validatedVotes, invalidCount } = validateArray(
        dedupedVoteRows,
        KoiosVoteListSchema,
        'votes',
      );
      validationErrors = invalidCount;
      if (invalidCount > 0) {
        emitPostHog(true, 'votes', 0, {
          event_override: 'sync_validation_error',
          record_type: 'vote',
          invalid_count: invalidCount,
        });
        alertDiscord(
          'Validation Errors: votes',
          `${invalidCount} vote records failed Zod validation`,
        );
      }

      if (validatedVotes.length > 0) {
        const result = await batchUpsert(
          supabase,
          'drep_votes',
          validatedVotes as unknown as Record<string, unknown>[],
          'vote_tx_hash',
          'Votes',
        );
        votesSynced = result.success;
        voteUpsertErrors = result.errors;
        logger.info('[VoteSync] Upserted votes', {
          success: result.success,
          errors: result.errors,
        });
      }

      if (dedupedRationaleRows.length > 0) {
        const existingRationaleRows = new Map<string, ExistingVoteRationaleRow>();
        const rationaleTxHashes = dedupedRationaleRows.map((row) => row.vote_tx_hash);

        for (let i = 0; i < rationaleTxHashes.length; i += 500) {
          const { data } = await supabase
            .from('vote_rationales')
            .select(
              'vote_tx_hash, drep_id, proposal_tx_hash, proposal_index, meta_url, rationale_text, fetched_at, fetch_status, fetch_attempts, fetch_last_attempted_at, fetch_last_error, next_fetch_at',
            )
            .in('vote_tx_hash', rationaleTxHashes.slice(i, i + 500));

          for (const row of data || []) {
            existingRationaleRows.set(row.vote_tx_hash, row as ExistingVoteRationaleRow);
          }
        }

        const plannedRationaleRows = planVoteRationaleUpserts(
          dedupedRationaleRows,
          existingRationaleRows,
        );
        rationaleRowsPlanned = plannedRationaleRows.length;

        if (plannedRationaleRows.length > 0) {
          const result = await batchUpsert(
            supabase,
            'vote_rationales',
            plannedRationaleRows as unknown as Record<string, unknown>[],
            'vote_tx_hash',
            'VoteRationales',
          );
          rationaleRowsUpserted = result.success;
        } else {
          logger.info('[VoteSync] Rationale queue already current', {
            candidates: dedupedRationaleRows.length,
          });
        }
      }

      const affectedDrepIds = Object.keys(bulkVotesMap);
      const computedCounts = new Map<
        string,
        { yes: number; no: number; abstain: number; total: number }
      >();

      for (let i = 0; i < affectedDrepIds.length; i += 200) {
        const batch = affectedDrepIds.slice(i, i + 200);
        const cachedVotes = await fetchAll(() =>
          supabase
            .from('drep_votes')
            .select('drep_id, proposal_tx_hash, proposal_index, vote, block_time, vote_tx_hash')
            .in('drep_id', batch),
        );

        const votesByDRep = new Map<
          string,
          Array<{
            proposal_tx_hash: string;
            proposal_index: number;
            vote: string;
            block_time: number;
            vote_tx_hash: string;
          }>
        >();

        for (const row of cachedVotes) {
          const drepId = row.drep_id as string;
          if (!votesByDRep.has(drepId)) votesByDRep.set(drepId, []);
          votesByDRep.get(drepId)!.push({
            proposal_tx_hash: row.proposal_tx_hash as string,
            proposal_index: row.proposal_index as number,
            vote: row.vote as string,
            block_time: row.block_time as number,
            vote_tx_hash: row.vote_tx_hash as string,
          });
        }

        for (const drepId of batch) {
          const latestVotes = dedupeLatestVotesByProposal(votesByDRep.get(drepId) || []);
          computedCounts.set(drepId, {
            yes: latestVotes.filter((vote) => vote.vote === 'Yes').length,
            no: latestVotes.filter((vote) => vote.vote === 'No').length,
            abstain: latestVotes.filter((vote) => vote.vote === 'Abstain').length,
            total: latestVotes.length,
          });
        }
      }

      const allCurrentInfo = new Map<string, Record<string, unknown>>();
      for (let i = 0; i < affectedDrepIds.length; i += 1000) {
        const { data } = await supabase
          .from('dreps')
          .select('id, info')
          .in('id', affectedDrepIds.slice(i, i + 1000));
        for (const row of data || []) {
          if (row.info) allCurrentInfo.set(row.id, row.info as Record<string, unknown>);
        }
      }

      const reconUpdates: Record<string, unknown>[] = [];
      for (const [drepId, counts] of computedCounts) {
        const info = allCurrentInfo.get(drepId);
        if (!info) continue;
        if (
          info.totalVotes === counts.total &&
          info.yesVotes === counts.yes &&
          info.noVotes === counts.no &&
          info.abstainVotes === counts.abstain
        )
          continue;

        reconUpdates.push({
          id: drepId,
          info: {
            ...info,
            totalVotes: counts.total,
            yesVotes: counts.yes,
            noVotes: counts.no,
            abstainVotes: counts.abstain,
          },
        });
      }

      if (reconUpdates.length > 0) {
        const result = await batchUpsert(
          supabase,
          'dreps',
          reconUpdates,
          'id',
          'VoteReconciliation',
        );
        reconciled = result.success;
      }

      if (maxBlockTime !== null && voteUpsertErrors === 0) {
        await setSyncCursorBlockTime(supabase, VOTE_CURSOR_SYNC_TYPE, maxBlockTime);
      }

      if (reconciled > 0) {
        logger.info('[VoteSync] Vote count reconciliation', { drepsUpdated: reconciled });
      }

      const metrics = {
        votes_synced: votesSynced,
        vote_upsert_errors: voteUpsertErrors,
        rationale_rows_planned: rationaleRowsPlanned,
        rationale_rows_upserted: rationaleRowsUpserted,
        reconciled,
        validation_errors: validationErrors,
        cursor_start_block_time: sinceBlockTime,
        cursor_end_block_time: maxBlockTime,
        ...getKoiosMetrics(),
      };
      await syncLog.finalize(true, null, metrics);
      await emitPostHog(true, 'votes', syncLog.elapsed, metrics);
      triggerAnalyticsDeploy('votes');

      return {
        success: true,
        votesSynced,
        reconciled,
        durationSeconds: (syncLog.elapsed / 1000).toFixed(1),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const msg = errMsg(err);
      logger.error('[VoteSync] Fatal error', { error: msg });
      const metrics = {
        votes_synced: votesSynced,
        vote_upsert_errors: voteUpsertErrors,
        rationale_rows_planned: rationaleRowsPlanned,
        rationale_rows_upserted: rationaleRowsUpserted,
        reconciled,
      };
      await syncLog.finalize(false, msg, metrics);
      await emitPostHog(false, 'votes', syncLog.elapsed, metrics);
      throw err;
    }
  });
}
