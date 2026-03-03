import { DRepVote } from '@/types/koios';
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
} from '@/lib/sync-utils';
import { KoiosVoteListSchema, validateArray } from '@/utils/koios-schemas';
import * as Sentry from '@sentry/nextjs';

interface SupabaseVoteRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  epoch_no: number | null;
  block_time: number;
  meta_url: string | null;
  meta_hash: string | null;
}

/**
 * Core votes sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeVotesSync(): Promise<Record<string, unknown>> {
  return Sentry.startSpan(
    { name: 'sync.votes', op: 'task' },
    async () => {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'votes');
  await syncLog.start();
  resetKoiosMetrics();

  let votesSynced = 0;
  let reconciled = 0;

  try {
    const bulkVotesMap: Record<string, DRepVote[]> = await fetchAllVotesBulk();
    const totalVotes = Object.values(bulkVotesMap).reduce((sum, v) => sum + v.length, 0);
    logger.info('[VoteSync] Bulk votes fetched', { totalVotes, drepCount: Object.keys(bulkVotesMap).length });

    const voteRows: SupabaseVoteRow[] = [];
    for (const [drepId, votes] of Object.entries(bulkVotesMap)) {
      for (const vote of votes) {
        voteRows.push({
          vote_tx_hash: vote.vote_tx_hash,
          drep_id: drepId,
          proposal_tx_hash: vote.proposal_tx_hash,
          proposal_index: vote.proposal_index,
          vote: vote.vote,
          epoch_no: vote.epoch_no ?? (vote.block_time ? blockTimeToEpoch(vote.block_time) : null),
          block_time: vote.block_time,
          meta_url: vote.meta_url,
          meta_hash: vote.meta_hash,
        });
      }
    }

    const dedupedVoteRows = [...new Map(voteRows.map((r) => [r.vote_tx_hash, r])).values()];
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
      logger.info('[VoteSync] Upserted votes', { success: result.success, errors: result.errors });
    }

    // Vote count reconciliation
    const drepIds = Object.keys(bulkVotesMap);

    const computedCounts = new Map<
      string,
      { yes: number; no: number; abstain: number; total: number }
    >();
    for (const drepId of drepIds) {
      const votes = bulkVotesMap[drepId];
      const latestByProposal = new Map<string, { vote: string; block_time: number }>();
      for (const v of votes) {
        const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
        const cur = latestByProposal.get(key);
        if (!cur || v.block_time > cur.block_time) {
          latestByProposal.set(key, { vote: v.vote, block_time: v.block_time });
        }
      }
      const deduped = [...latestByProposal.values()];
      computedCounts.set(drepId, {
        yes: deduped.filter((v) => v.vote === 'Yes').length,
        no: deduped.filter((v) => v.vote === 'No').length,
        abstain: deduped.filter((v) => v.vote === 'Abstain').length,
        total: deduped.length,
      });
    }

    const allCurrentInfo = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < drepIds.length; i += 1000) {
      const { data } = await supabase
        .from('dreps')
        .select('id, info')
        .in('id', drepIds.slice(i, i + 1000));
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
      const result = await batchUpsert(supabase, 'dreps', reconUpdates, 'id', 'VoteReconciliation');
      reconciled = result.success;
    }

    if (reconciled > 0) {
      logger.info('[VoteSync] Vote count reconciliation', { drepsUpdated: reconciled });
    }

    const metrics = {
      votes_synced: votesSynced,
      reconciled,
      validation_errors: validationErrors,
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
    const metrics = { votes_synced: votesSynced, reconciled };
    await syncLog.finalize(false, msg, metrics);
    await emitPostHog(false, 'votes', syncLog.elapsed, metrics);
    throw err;
  }
    },
  );
}
