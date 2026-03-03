/**
 * Proposals Sync — Inngest durable function.
 * Runs every 30 min. Each step retries independently.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { fetchProposals, fetchVotesForProposals, fetchProposalVotingSummary } from '@/utils/koios';
import { classifyProposals } from '@/lib/alignment';
import { errMsg, emitPostHog, pingHeartbeat, alertDiscord } from '@/lib/sync-utils';
import { KoiosProposalSchema, validateArray } from '@/utils/koios-schemas';
import type { ProposalListResponse } from '@/types/koios';

const BATCH_SIZE = 100;
const SUMMARY_CONCURRENCY = 5;

export const syncProposals = inngest.createFunction(
  {
    id: 'sync-proposals',
    retries: 3,
    concurrency: {
      limit: 2,
      scope: 'env',
      key: '"koios-frequent"',
    },
  },
  [{ cron: '*/30 * * * *' }, { event: 'drepscore/sync.proposals' }],
  async ({ step }) => {
    // Step 1: Fetch proposals from Koios, classify, upsert to DB
    const step1 = await step.run('fetch-and-upsert-proposals', async () => {
      const supabase = getSupabaseAdmin();
      const errors: string[] = [];
      const startTime = Date.now();

      let logId: number | null = null;
      try {
        const { data: logRow } = await supabase
          .from('sync_log')
          .insert({ sync_type: 'proposals', started_at: new Date().toISOString(), success: false })
          .select('id')
          .single();
        logId = logRow?.id ?? null;
      } catch (e) {
        console.warn('[proposals] sync_log insert failed:', errMsg(e));
      }

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
          console.error('[proposals] Proposal upsert error:', error.message);
        }
      }

      const openProposals = classified
        .filter((p) => !p.ratifiedEpoch && !p.enactedEpoch && !p.droppedEpoch && !p.expiredEpoch)
        .map((p) => ({ txHash: p.txHash, index: p.index }));

      console.log(
        `[proposals] ${proposalRows.length} proposals upserted, ${openProposals.length} open`,
      );

      return { logId, proposalCount: proposalRows.length, openProposals, errors, startTime };
    });

    // Step 2: Fetch and upsert votes for open proposals
    const step2 =
      step1.openProposals.length > 0
        ? await step.run('fetch-and-upsert-votes', async () => {
            const supabase = getSupabaseAdmin();
            const errors: string[] = [];

            const votesMap = await fetchVotesForProposals(step1.openProposals);
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

            const deduped = [
              ...new Map(voteRows.map((r) => [r.vote_tx_hash as string, r])).values(),
            ];

            for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
              const batch = deduped.slice(i, i + BATCH_SIZE);
              const { error } = await supabase
                .from('drep_votes')
                .upsert(batch, { onConflict: 'vote_tx_hash', ignoreDuplicates: false });
              if (error) {
                errors.push(`Vote upsert: ${error.message}`);
                console.error('[proposals] Vote upsert error:', error.message);
              }
            }

            console.log(
              `[proposals] ${deduped.length} votes upserted for ${step1.openProposals.length} open proposals`,
            );
            return { voteCount: deduped.length, errors };
          })
        : { voteCount: 0, errors: [] as string[] };

    // Step 3: Refresh canonical voting summaries for all open proposals
    let summaryCount = 0;
    if (step1.openProposals.length > 0) {
      summaryCount = await step.run('refresh-voting-summaries', async () => {
        const supabase = getSupabaseAdmin();

        const { data: openWithId } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, proposal_id')
          .is('ratified_epoch', null)
          .is('enacted_epoch', null)
          .is('dropped_epoch', null)
          .is('expired_epoch', null)
          .not('proposal_id', 'is', null);

        const proposals = openWithId || [];
        let count = 0;

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
          count += results.filter((r) => r.status === 'fulfilled' && r.value).length;
        }

        if (count > 0) console.log(`[proposals] Voting summaries: ${count} refreshed`);
        return count;
      });
    }

    // Step 4: Broadcast critical proposal notifications via unified engine
    const pushSent = await step.run('broadcast-critical-proposals', async () => {
      try {
        const supabase = getSupabaseAdmin();
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

        if (critical.length === 0) return 0;

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
        await broadcastDiscord(event).catch((e) =>
          console.error('[proposals] broadcastDiscord failed:', e),
        );
        const sent = await broadcastEvent(event);
        return sent;
      } catch (err) {
        console.warn('[proposals] Notification broadcast skipped:', err);
        return 0;
      }
    });

    // Step 5: Finalize sync log and emit analytics
    await step.run('finalize-sync-log', async () => {
      if (!step1.logId) return;

      const supabase = getSupabaseAdmin();
      const durationMs = Date.now() - step1.startTime;
      const allErrors = [...step1.errors, ...step2.errors];
      const success = allErrors.length === 0;

      const metrics = {
        proposals_synced: step1.proposalCount,
        votes_synced: step2.voteCount,
        summaries_refreshed: summaryCount,
        push_sent: pushSent,
      };

      await supabase
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          success,
          error_message: allErrors.length > 0 ? allErrors.join('; ').slice(0, 2000) : null,
          metrics,
        })
        .eq('id', step1.logId);

      await emitPostHog(success, 'proposals', durationMs, metrics);

      const duration = (durationMs / 1000).toFixed(1);
      console.log(
        `[proposals] Complete in ${duration}s — ${step1.proposalCount} proposals, ${step2.voteCount} votes` +
          `${pushSent > 0 ? `, ${pushSent} push` : ''}` +
          `${allErrors.length > 0 ? ` (${allErrors.length} errors)` : ''}`,
      );

      if (success) await pingHeartbeat('HEARTBEAT_URL_PROPOSALS');
    });

    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_PROPOSALS'));
  },
);
