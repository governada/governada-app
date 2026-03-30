/**
 * SPO + CC Vote Sync — fetches SPO and Constitutional Committee votes from Koios,
 * upserts to spo_votes and cc_votes tables, then computes inter-body alignment.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchAllSPOVotesBulk, fetchAllCCVotesBulk } from '@/utils/koios';
import {
  SyncLogger,
  batchUpsert,
  errMsg,
  emitPostHog,
  capMsg,
  alertCritical,
} from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import { computeAndCacheAlignment } from '@/lib/interBodyAlignment';

export const syncSpoAndCcVotes = inngest.createFunction(
  {
    id: 'sync-spo-cc-votes',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"spo-cc-votes"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[spo-cc-votes] Function failed permanently', { error });
      // Clean up ghost entries for both sync types this function manages
      await Promise.all([
        sb
          .from('sync_log')
          .update({
            finished_at: new Date().toISOString(),
            success: false,
            error_message: capMsg(`onFailure: ${msg}`),
          })
          .eq('sync_type', 'spo_votes')
          .is('finished_at', null),
        sb
          .from('sync_log')
          .update({
            finished_at: new Date().toISOString(),
            success: false,
            error_message: capMsg(`onFailure: ${msg}`),
          })
          .eq('sync_type', 'cc_votes')
          .is('finished_at', null),
      ]);
      await alertCritical(
        'SPO/CC Votes Sync Failed',
        `SPO/CC votes sync failed after all retries.\nError: ${msg}\nCheck logs for details.`,
      );
    },
    triggers: [{ cron: '45 */6 * * *' }, { event: 'drepscore/sync.spo-cc-votes' }],
  },
  async ({ step }) => {
    const spoResult = await step.run('fetch-spo-votes', async () => {
      const supabase = getSupabaseAdmin();
      const logger = new SyncLogger(supabase, 'spo_votes');
      await logger.start();

      try {
        const votes = await fetchAllSPOVotesBulk();

        const rows = votes.map((v) => ({
          pool_id: v.pool_id,
          proposal_tx_hash: v.proposal_tx_hash,
          proposal_index: v.proposal_index,
          vote: v.vote,
          block_time: v.block_time,
          tx_hash: v.tx_hash,
          epoch: v.epoch,
        }));

        let upserted = 0;
        if (rows.length > 0) {
          const result = await batchUpsert(
            supabase,
            'spo_votes',
            rows,
            'pool_id,proposal_tx_hash,proposal_index',
            'spo-votes',
          );
          upserted = result.success;
        }

        await logger.finalize(true, null, { spoVotesFetched: votes.length, upserted });
        return { fetched: votes.length, upserted };
      } catch (err) {
        await logger.finalize(false, errMsg(err), {});
        throw err;
      }
    });

    const ccResult = await step.run('fetch-cc-votes', async () => {
      const supabase = getSupabaseAdmin();
      const logger = new SyncLogger(supabase, 'cc_votes');
      await logger.start();

      try {
        const votes = await fetchAllCCVotesBulk();

        // Build hot→cold mapping from committee_members for credential resolution
        const { data: committeeMembers } = await supabase
          .from('committee_members')
          .select('cc_hot_id, cc_cold_id');
        const hotToCold = new Map<string, string>();
        for (const m of committeeMembers ?? []) {
          if (m.cc_cold_id) hotToCold.set(m.cc_hot_id, m.cc_cold_id);
        }

        // Deduplicate: a voter can change their vote, producing multiple rows
        // for the same (cc_hot_id, proposal_tx_hash, proposal_index). Keep the
        // latest by block_time to avoid "ON CONFLICT cannot affect row a second time".
        const deduped = new Map<string, (typeof votes)[number]>();
        for (const v of votes) {
          const key = `${v.cc_hot_id}:${v.proposal_tx_hash}:${v.proposal_index}`;
          const existing = deduped.get(key);
          if (!existing || v.block_time > existing.block_time) {
            deduped.set(key, v);
          }
        }

        const rows = [...deduped.values()].map((v) => ({
          cc_hot_id: v.cc_hot_id,
          cc_cold_id: hotToCold.get(v.cc_hot_id) ?? null,
          proposal_tx_hash: v.proposal_tx_hash,
          proposal_index: v.proposal_index,
          vote: v.vote,
          block_time: v.block_time,
          tx_hash: v.tx_hash,
          epoch: v.epoch,
          meta_url: v.meta_url,
          meta_hash: v.meta_hash,
        }));

        let upserted = 0;
        if (rows.length > 0) {
          const result = await batchUpsert(
            supabase,
            'cc_votes',
            rows,
            'cc_hot_id,proposal_tx_hash,proposal_index',
            'cc-votes',
          );
          upserted = result.success;
        }

        await logger.finalize(true, null, { ccVotesFetched: votes.length, upserted });
        return { fetched: votes.length, upserted };
      } catch (err) {
        await logger.finalize(false, errMsg(err), {});
        throw err;
      }
    });

    const alignmentResult = await step.run('compute-alignment', async () => {
      try {
        const upserted = await computeAndCacheAlignment();
        return { alignmentCached: upserted };
      } catch (err) {
        logger.error('[sync-spo-cc-votes] Alignment computation failed', { error: err });
        return { alignmentCached: 0, error: errMsg(err) };
      }
    });

    const snapshotResult = await step.run('snapshot-alignment', async () => {
      try {
        const supabase = getSupabaseAdmin();

        const { data: statsRow } = await supabase
          .from('governance_stats')
          .select('current_epoch')
          .eq('id', 1)
          .single();
        const epoch = statsRow?.current_epoch ?? 0;
        if (epoch === 0) return { snapshotted: 0 };

        const { data: cached } = await supabase.from('inter_body_alignment').select('*');
        if (!cached?.length) return { snapshotted: 0 };

        let inserted = 0;
        let alreadyExisted = 0;
        for (const row of cached) {
          const { data: existing } = await supabase
            .from('inter_body_alignment_snapshots')
            .select('epoch')
            .eq('epoch', epoch)
            .eq('proposal_tx_hash', row.proposal_tx_hash)
            .eq('proposal_index', row.proposal_index)
            .maybeSingle();
          if (existing) {
            alreadyExisted++;
            continue;
          }

          const [drepCount, spoCount, ccCount] = await Promise.all([
            supabase
              .from('drep_votes')
              .select('vote_tx_hash', { count: 'exact', head: true })
              .eq('proposal_tx_hash', row.proposal_tx_hash)
              .eq('proposal_index', row.proposal_index),
            supabase
              .from('spo_votes')
              .select('pool_id', { count: 'exact', head: true })
              .eq('proposal_tx_hash', row.proposal_tx_hash)
              .eq('proposal_index', row.proposal_index),
            supabase
              .from('cc_votes')
              .select('cc_hot_id', { count: 'exact', head: true })
              .eq('proposal_tx_hash', row.proposal_tx_hash)
              .eq('proposal_index', row.proposal_index),
          ]);

          const { error } = await supabase.from('inter_body_alignment_snapshots').insert({
            epoch,
            proposal_tx_hash: row.proposal_tx_hash,
            proposal_index: row.proposal_index,
            drep_yes_pct: row.drep_yes_pct ?? 0,
            drep_no_pct: row.drep_no_pct ?? 0,
            drep_total: drepCount.count ?? 0,
            spo_yes_pct: row.spo_yes_pct ?? 0,
            spo_no_pct: row.spo_no_pct ?? 0,
            spo_total: spoCount.count ?? 0,
            cc_yes_pct: row.cc_yes_pct ?? 0,
            cc_no_pct: row.cc_no_pct ?? 0,
            cc_total: ccCount.count ?? 0,
            alignment_score: row.alignment_score ?? 0,
          });
          if (!error) inserted++;
        }

        // Coverage = total snapshots for this epoch (existing + newly inserted)
        const totalCovered = alreadyExisted + inserted;
        await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'inter_body_alignment',
            epoch_no: epoch,
            snapshot_date: new Date().toISOString().slice(0, 10),
            record_count: totalCovered,
            expected_count: cached.length,
            coverage_pct:
              cached.length > 0 ? Math.round((totalCovered / cached.length) * 10000) / 100 : 100,
          },
          { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
        );

        logger.info('[sync-spo-cc-votes] Alignment snapshots stored', {
          inserted,
          alreadyExisted,
          totalCovered,
          total: cached.length,
          epoch,
        });
        return { snapshotted: inserted, alreadyExisted, epoch };
      } catch (err) {
        logger.error('[sync-spo-cc-votes] Alignment snapshot failed', { error: err });
        return { snapshotted: 0, error: errMsg(err) };
      }
    });

    await step.run('emit-analytics', async () => {
      await emitPostHog(true, 'spo_votes', 0, {
        spo_votes: spoResult.fetched,
        cc_votes: ccResult.fetched,
        alignment_cached: alignmentResult.alignmentCached,
        alignment_snapshotted: snapshotResult.snapshotted,
      });
    });

    // Emit events for downstream Constitutional Intelligence pipeline
    if (ccResult.fetched > 0) {
      await step.sendEvent('cc-votes-synced', {
        name: 'cc/votes.synced',
        data: { count: ccResult.fetched },
      });
    }

    return {
      spo: spoResult,
      cc: ccResult,
      alignment: alignmentResult,
      snapshot: snapshotResult,
    };
  },
);
