import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { SyncLogger, errMsg, emitPostHog, alertDiscord } from '@/lib/sync-utils';
import { blockTimeToEpoch } from '@/lib/koios';
import { fetchProposals, fetchVotesForProposals, fetchProposalVotingSummary } from '@/utils/koios';
import { classifyProposals } from '@/lib/alignment';
import { KoiosProposalSchema, validateArray } from '@/utils/koios-schemas';
import type { ProposalListResponse } from '@/types/koios';
import * as Sentry from '@sentry/nextjs';

const BATCH_SIZE = 100;
const SUMMARY_CONCURRENCY = 5;
const TAG = '[proposals]';

/**
 * Core proposals sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeProposalsSync(): Promise<Record<string, unknown>> {
  return Sentry.startSpan(
    { name: 'sync.proposals', op: 'task' },
    async () => {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'proposals');
  await syncLog.start();

  const errors: string[] = [];
  let proposalCount = 0;
  let voteCount = 0;
  let summaryCount = 0;
  let voteSnapshotCount = 0;
  let pushSent = 0;

  let openProposals: { txHash: string; index: number }[] = [];

  try {
    // --- Fetch, classify, upsert proposals ---
    try {
      const rawProposals = await fetchProposals();
      const {
        valid: validProposals,
        invalidCount,
        errors: validationErrors,
      } = validateArray(rawProposals, KoiosProposalSchema, 'proposals');

      if (invalidCount > 0) {
        errors.push(...validationErrors);
        emitPostHog(true, 'proposals', 0, {
          event_override: 'sync_validation_error',
          record_type: 'proposal',
          invalid_count: invalidCount,
        });
        alertDiscord(
          'Validation Errors: proposals',
          `${invalidCount} proposal records failed Zod validation`,
        );
      }

      const classified = classifyProposals(validProposals as unknown as ProposalListResponse);

      const proposalRows = [
        ...new Map(
          classified.map((p) => [
            `${p.txHash}-${p.index}`,
            {
              tx_hash: p.txHash,
              proposal_index: p.index,
              proposal_id: p.proposalId,
              proposal_type: p.type,
              title: p.title,
              abstract: p.abstract,
              withdrawal_amount: p.withdrawalAmountAda,
              treasury_tier: p.treasuryTier,
              param_changes: p.paramChanges,
              relevant_prefs: p.relevantPrefs,
              proposed_epoch: p.proposedEpoch,
              block_time: p.blockTime,
              expired_epoch: p.expiredEpoch,
              ratified_epoch: p.ratifiedEpoch,
              enacted_epoch: p.enactedEpoch,
              dropped_epoch: p.droppedEpoch,
              expiration_epoch: p.expirationEpoch,
            },
          ]),
        ).values(),
      ];

      for (let i = 0; i < proposalRows.length; i += BATCH_SIZE) {
        const batch = proposalRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('proposals')
          .upsert(batch, { onConflict: 'tx_hash,proposal_index', ignoreDuplicates: false });
        if (error) {
          errors.push(`Proposal upsert: ${error.message}`);
          logger.error(`${TAG} Proposal upsert error`, { error: error.message });
        }
      }

      proposalCount = proposalRows.length;

      openProposals = classified
        .filter((p) => !p.ratifiedEpoch && !p.enactedEpoch && !p.droppedEpoch && !p.expiredEpoch)
        .map((p) => ({ txHash: p.txHash, index: p.index }));

      logger.info(`${TAG} Proposals upserted`, { count: proposalCount, open: openProposals.length });
    } catch (err) {
      errors.push(`Proposals: ${errMsg(err)}`);
      logger.error(`${TAG} Proposal fetch failed`, { error: errMsg(err) });
    }

    // --- Fetch and upsert votes for open proposals ---
    if (openProposals.length > 0) {
      try {
        const votesMap = await fetchVotesForProposals(openProposals);
        const voteRows: Record<string, unknown>[] = [];

        for (const [drepId, votes] of Object.entries(votesMap)) {
          for (const vote of votes) {
            voteRows.push({
              vote_tx_hash: vote.vote_tx_hash,
              drep_id: drepId,
              proposal_tx_hash: vote.proposal_tx_hash,
              proposal_index: vote.proposal_index,
              vote: vote.vote,
              epoch_no:
                vote.epoch_no ?? (vote.block_time ? blockTimeToEpoch(vote.block_time) : null),
              block_time: vote.block_time,
              meta_url: vote.meta_url,
              meta_hash: vote.meta_hash,
            });
          }
        }

        const deduped = [...new Map(voteRows.map((r) => [r.vote_tx_hash as string, r])).values()];

        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const batch = deduped.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from('drep_votes')
            .upsert(batch, { onConflict: 'vote_tx_hash', ignoreDuplicates: false });
          if (error) {
            errors.push(`Vote upsert: ${error.message}`);
            logger.error(`${TAG} Vote upsert error`, { error: error.message });
          }
        }

        voteCount = deduped.length;
        logger.info(`${TAG} Votes upserted`, { count: voteCount, openProposals: openProposals.length });
      } catch (err) {
        errors.push(`Votes: ${errMsg(err)}`);
        logger.error(`${TAG} Vote fetch failed`, { error: errMsg(err) });
      }
    }

    // --- Refresh voting summaries for open proposals ---
    if (openProposals.length > 0) {
      try {
        const { data: openWithId } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, proposal_id')
          .is('ratified_epoch', null)
          .is('enacted_epoch', null)
          .is('dropped_epoch', null)
          .is('expired_epoch', null)
          .not('proposal_id', 'is', null);

        const proposals = openWithId || [];

        for (let i = 0; i < proposals.length; i += SUMMARY_CONCURRENCY) {
          const chunk = proposals.slice(i, i + SUMMARY_CONCURRENCY);
          const results = await Promise.allSettled(
            chunk.map(async (p) => {
              const summary = await fetchProposalVotingSummary(p.proposal_id);
              if (!summary) return false;
              await supabase.from('proposal_voting_summary').upsert(
                {
                  proposal_tx_hash: p.tx_hash,
                  proposal_index: p.proposal_index,
                  epoch_no: summary.epoch_no,
                  drep_yes_votes_cast: summary.drep_yes_votes_cast,
                  drep_yes_vote_power: parseInt(summary.drep_active_yes_vote_power || '0', 10),
                  drep_no_votes_cast: summary.drep_no_votes_cast,
                  drep_no_vote_power: parseInt(summary.drep_active_no_vote_power || '0', 10),
                  drep_abstain_votes_cast: summary.drep_abstain_votes_cast,
                  drep_abstain_vote_power: parseInt(
                    summary.drep_active_abstain_vote_power || '0',
                    10,
                  ),
                  drep_always_abstain_power: parseInt(
                    summary.drep_always_abstain_vote_power || '0',
                    10,
                  ),
                  drep_always_no_confidence_power: parseInt(
                    summary.drep_always_no_confidence_vote_power || '0',
                    10,
                  ),
                  pool_yes_votes_cast: summary.pool_yes_votes_cast,
                  pool_yes_vote_power: parseInt(summary.pool_active_yes_vote_power || '0', 10),
                  pool_no_votes_cast: summary.pool_no_votes_cast,
                  pool_no_vote_power: parseInt(summary.pool_active_no_vote_power || '0', 10),
                  pool_abstain_votes_cast: summary.pool_abstain_votes_cast,
                  pool_abstain_vote_power: parseInt(
                    summary.pool_active_abstain_vote_power || '0',
                    10,
                  ),
                  committee_yes_votes_cast: summary.committee_yes_votes_cast,
                  committee_no_votes_cast: summary.committee_no_votes_cast,
                  committee_abstain_votes_cast: summary.committee_abstain_votes_cast,
                  fetched_at: new Date().toISOString(),
                },
                { onConflict: 'proposal_tx_hash,proposal_index' },
              );
              return true;
            }),
          );
          summaryCount += results.filter((r) => r.status === 'fulfilled' && r.value).length;
        }

        if (summaryCount > 0) logger.info(`${TAG} Voting summaries refreshed`, { count: summaryCount });
      } catch (err) {
        logger.warn(`${TAG} Voting summary refresh error`, { error: errMsg(err) });
      }
    }

    // --- Snapshot vote tallies for historical accumulation curve ---
    if (openProposals.length > 0) {
      try {
        const { data: statsRow } = await supabase
          .from('governance_stats')
          .select('current_epoch')
          .eq('id', 1)
          .single();
        const epoch = statsRow?.current_epoch ?? 0;

        if (epoch > 0) {
          const { data: summaries } = await supabase
            .from('proposal_voting_summary')
            .select('*')
            .in(
              'proposal_tx_hash',
              openProposals.map((p) => p.txHash),
            );

          if (summaries?.length) {
            const txHashes = [...new Set(summaries.map((s) => s.proposal_tx_hash))];
            const { data: existing } = await supabase
              .from('proposal_vote_snapshots')
              .select('proposal_tx_hash, proposal_index')
              .eq('epoch', epoch)
              .in('proposal_tx_hash', txHashes);
            const existingKeys = new Set(
              (existing ?? []).map((r) => `${r.proposal_tx_hash}|${r.proposal_index}`),
            );
            const toInsert = summaries.filter(
              (s) => !existingKeys.has(`${s.proposal_tx_hash}|${s.proposal_index}`),
            );
            let inserted = 0;
            for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
              const batch = toInsert.slice(i, i + BATCH_SIZE).map((s) => ({
                epoch,
                proposal_tx_hash: s.proposal_tx_hash,
                proposal_index: s.proposal_index,
                drep_yes_count: s.drep_yes_votes_cast ?? 0,
                drep_no_count: s.drep_no_votes_cast ?? 0,
                drep_abstain_count: s.drep_abstain_votes_cast ?? 0,
                drep_yes_power: s.drep_yes_vote_power ?? 0,
                drep_no_power: s.drep_no_vote_power ?? 0,
                spo_yes_count: s.pool_yes_votes_cast ?? 0,
                spo_no_count: s.pool_no_votes_cast ?? 0,
                spo_abstain_count: s.pool_abstain_votes_cast ?? 0,
                cc_yes_count: s.committee_yes_votes_cast ?? 0,
                cc_no_count: s.committee_no_votes_cast ?? 0,
                cc_abstain_count: s.committee_abstain_votes_cast ?? 0,
              }));
              const { error } = await supabase.from('proposal_vote_snapshots').insert(batch);
              if (!error) inserted += batch.length;
            }
            voteSnapshotCount = inserted;
            if (inserted > 0) {
              logger.info(`${TAG} Vote snapshots`, { inserted, epoch });
            }
          }
        }
      } catch (err) {
        logger.warn(`${TAG} Vote snapshot failed (non-fatal)`, { error: errMsg(err) });
      }
    }

    // --- Broadcast critical proposal notifications ---
    try {
      const { getProposalPriority } = await import('@/utils/proposalPriority');
      const { data: openCritical } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, proposal_type')
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null);

      const critical = (openCritical || []).filter(
        (p: Record<string, unknown>) =>
          getProposalPriority(p.proposal_type as string) === 'critical',
      );

      if (critical.length > 0) {
        const newest = critical[0];
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io';
        const { broadcastEvent, broadcastDiscord } = await import('@/lib/notifications');
        const event = {
          eventType: 'critical-proposal-open' as const,
          title: 'Critical Proposal Open',
          body:
            (newest.title as string) || 'A critical governance proposal requires DRep attention.',
          url: `${baseUrl}/proposals/${newest.tx_hash}/${newest.proposal_index}`,
          metadata: { txHash: newest.tx_hash, index: newest.proposal_index },
        };
        await broadcastDiscord(event).catch(() => {});
        pushSent = await broadcastEvent(event);
      }
    } catch (err) {
      logger.warn(`${TAG} Notification broadcast skipped`, { error: err });
    }
  } catch (err) {
    errors.push(`Unhandled: ${errMsg(err)}`);
    logger.error(`${TAG} Unhandled error`, { error: errMsg(err) });
  }

  const success = errors.length === 0;
  const metrics = {
    proposals_synced: proposalCount,
    votes_synced: voteCount,
    summaries_refreshed: summaryCount,
    vote_snapshots: voteSnapshotCount,
    push_sent: pushSent,
  };

  await syncLog.finalize(success, errors.length > 0 ? errors.join('; ') : null, metrics);
  await emitPostHog(success, 'proposals', syncLog.elapsed, metrics);

  if (!success) {
    throw new Error(errors.join('; '));
  }

  return {
    success,
    proposals: proposalCount,
    votes: voteCount,
    summariesRefreshed: summaryCount,
    voteSnapshots: voteSnapshotCount,
    pushSent,
    durationSeconds: (syncLog.elapsed / 1000).toFixed(1),
    timestamp: new Date().toISOString(),
  };
    },
  );
}
