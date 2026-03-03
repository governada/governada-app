/**
 * Proposal Sync — LEGACY manual fallback.
 * Scheduling now handled by Inngest (see inngest/functions/sync-proposals.ts).
 * This route remains callable via CRON_SECRET for manual recovery / debugging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { blockTimeToEpoch } from '@/lib/koios';
import { fetchProposals, fetchVotesForProposals, fetchProposalVotingSummary } from '@/utils/koios';
import { classifyProposals } from '@/lib/alignment';
import {
  authorizeCron,
  initSupabase,
  SyncLogger,
  errMsg,
  emitPostHog,
  alertDiscord,
} from '@/lib/sync-utils';
import { KoiosProposalSchema, validateArray } from '@/utils/koios-schemas';
import type { ProposalListResponse } from '@/types/koios';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH_SIZE = 100;
const SUMMARY_CONCURRENCY = 5;
const TAG = '[proposals]';

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === retries) throw e;
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `${TAG} ${label} attempt ${attempt + 1} failed: ${errMsg(e)}, retrying in ${delay}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

export async function GET(request: NextRequest) {
  const authErr = authorizeCron(request);
  if (authErr) return authErr;

  const result = initSupabase();
  if ('error' in result) return result.error;
  const { supabase } = result;

  const logger = new SyncLogger(supabase, 'proposals');
  await logger.start();

  console.log(`${TAG} Starting...`);

  const errors: string[] = [];
  let proposalCount = 0;
  let voteCount = 0;
  let pushSent = 0;
  let proposalOk = false;
  let voteOk = false;

  try {
    let openProposals: { txHash: string; index: number }[] = [];

    try {
      const rawProposals = await withRetry(() => fetchProposals(), 'fetchProposals');
      const {
        valid: validProposals,
        invalidCount,
        errors: valErrors,
      } = validateArray(rawProposals, KoiosProposalSchema, 'proposals');
      if (invalidCount > 0) {
        errors.push(...valErrors);
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

      let upsertErrors = 0;
      for (let i = 0; i < proposalRows.length; i += BATCH_SIZE) {
        const batch = proposalRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('proposals')
          .upsert(batch, { onConflict: 'tx_hash,proposal_index', ignoreDuplicates: false });
        if (error) {
          upsertErrors++;
          errors.push(`Proposal upsert: ${error.message}`);
          console.error(`${TAG} Proposal upsert error:`, error.message);
        }
      }
      proposalCount = proposalRows.length;
      proposalOk = upsertErrors === 0;

      openProposals = classified
        .filter((p) => !p.ratifiedEpoch && !p.enactedEpoch && !p.droppedEpoch && !p.expiredEpoch)
        .map((p) => ({ txHash: p.txHash, index: p.index }));

      console.log(`${TAG} Proposals: ${proposalCount} upserted, ${openProposals.length} open`);
    } catch (err) {
      errors.push(`Proposals: ${errMsg(err)}`);
      console.error(`${TAG} Proposal fetch failed:`, errMsg(err));
    }

    if (openProposals.length > 0) {
      try {
        const votesMap = await withRetry(
          () => fetchVotesForProposals(openProposals),
          'fetchVotesForProposals',
        );
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

        let voteUpsertErrors = 0;
        for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
          const batch = deduped.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from('drep_votes')
            .upsert(batch, { onConflict: 'vote_tx_hash', ignoreDuplicates: false });
          if (error) {
            voteUpsertErrors++;
            errors.push(`Vote upsert: ${error.message}`);
            console.error(`${TAG} Vote upsert error:`, error.message);
          }
        }
        voteCount = deduped.length;
        voteOk = voteUpsertErrors === 0;
        console.log(
          `${TAG} Votes: ${voteCount} upserted for ${openProposals.length} open proposals`,
        );
      } catch (err) {
        errors.push(`Votes: ${errMsg(err)}`);
        console.error(`${TAG} Vote fetch failed:`, errMsg(err));
      }
    } else {
      voteOk = true;
    }

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
        let summaryCount = 0;

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
        if (summaryCount > 0) console.log(`${TAG} Voting summaries: ${summaryCount} refreshed`);
      } catch (err) {
        console.warn(
          `${TAG} Voting summary refresh error:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

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
      console.warn(`${TAG} Notification broadcast skipped:`, err);
    }
  } catch (err) {
    const msg = errMsg(err);
    errors.push(`Unhandled: ${msg}`);
    console.error(`${TAG} Unhandled error:`, msg);
  }

  const durationMs = logger.elapsed;
  const duration = (durationMs / 1000).toFixed(1);
  const success = proposalOk && voteOk && errors.length === 0;

  console.log(
    `${TAG} Complete in ${duration}s — ${proposalCount} proposals, ${voteCount} votes${pushSent > 0 ? `, ${pushSent} push` : ''}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
  );

  const metrics = { proposals_synced: proposalCount, votes_synced: voteCount, push_sent: pushSent };

  await logger.finalize(success, errors.length > 0 ? errors.join('; ') : null, metrics);
  await emitPostHog(success, 'proposals', durationMs, metrics);

  return NextResponse.json(
    {
      success,
      proposals: proposalCount,
      votes: voteCount,
      pushSent,
      errors: errors.length > 0 ? errors : undefined,
      durationSeconds: duration,
      timestamp: new Date().toISOString(),
    },
    { status: success ? 200 : 207 },
  );
}
