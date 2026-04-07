import { getSupabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';
import { logger } from '@/lib/logger';
import { SyncLogger, errMsg, emitPostHog, alertDiscord } from '@/lib/sync-utils';
import { fetchProposals, fetchProposalVotingSummary } from '@/utils/koios';
import { classifyProposals } from '@/lib/alignment';
import { KoiosProposalSchema, validateArray } from '@/utils/koios-schemas';
import type { ProposalListResponse } from '@/types/koios';
import * as Sentry from '@sentry/nextjs';
import {
  isAvailable as isBlockfrostAvailable,
  fetchProposalsEnriched,
  type BlockfrostProposalDetail,
} from '@/lib/reconciliation/blockfrost';

const BATCH_SIZE = 100;
const SUMMARY_CONCURRENCY = 5;
const TAG = '[proposals]';

/** Map Blockfrost governance_type to our proposal_type enum */
function mapBlockfrostGovernanceType(bfType: string): string {
  const map: Record<string, string> = {
    treasury_withdrawals: 'TreasuryWithdrawals',
    info_action: 'InfoAction',
    hard_fork_initiation: 'HardForkInitiation',
    no_confidence: 'NoConfidence',
    new_committee: 'UpdateCommittee',
    new_constitution: 'NewConstitution',
    parameter_change: 'ParameterChange',
  };
  return map[bfType] ?? bfType;
}

/**
 * Core proposals sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeProposalsSync(): Promise<Record<string, unknown>> {
  return Sentry.startSpan({ name: 'sync.proposals', op: 'task' }, async () => {
    const supabase = getSupabaseAdmin();
    const syncLog = new SyncLogger(supabase, 'proposals');
    await syncLog.start();

    const fatalErrors: string[] = [];
    const warnings: string[] = [];
    let proposalCount = 0;
    let voteSyncsTriggered = 0;
    let summaryCount = 0;
    const voteSnapshotCount = 0;
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
          warnings.push(...validationErrors);
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

        // Build a map of raw meta_json by proposal key for enrichment
        const rawMetaMap = new Map<string, unknown>();
        for (const raw of validProposals) {
          const r = raw as unknown as ProposalListResponse[number];
          if (r.meta_json) {
            rawMetaMap.set(`${r.proposal_tx_hash}-${r.proposal_index}`, r.meta_json);
          }
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
                meta_json: rawMetaMap.get(`${p.txHash}-${p.index}`) ?? null,
                withdrawal_amount:
                  p.withdrawalAmountAda != null ? Math.round(p.withdrawalAmountAda) : null,
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
            fatalErrors.push(`Proposal upsert: ${error.message}`);
            logger.error(`${TAG} Proposal upsert error`, { error: error.message });
          }
        }

        proposalCount = proposalRows.length;

        openProposals = classified
          .filter((p) => !p.ratifiedEpoch && !p.enactedEpoch && !p.droppedEpoch && !p.expiredEpoch)
          .map((p) => ({ txHash: p.txHash, index: p.index }));

        logger.info(`${TAG} Proposals upserted`, {
          count: proposalCount,
          open: openProposals.length,
        });
      } catch (err) {
        const koiosError = errMsg(err);
        logger.error(`${TAG} Koios proposal fetch failed, trying Blockfrost fallback`, {
          error: koiosError,
        });

        // --- Blockfrost fallback: update lifecycle epochs for existing proposals ---
        try {
          if (await isBlockfrostAvailable()) {
            const bfProposals = await fetchProposalsEnriched();
            if (bfProposals.length > 0) {
              const lifecycleRows = bfProposals.map((p: BlockfrostProposalDetail) => ({
                tx_hash: p.tx_hash,
                proposal_index: p.cert_index,
                proposal_type: mapBlockfrostGovernanceType(p.governance_type),
                ratified_epoch: p.ratified_epoch,
                enacted_epoch: p.enacted_epoch,
                dropped_epoch: p.dropped_epoch,
                expired_epoch: p.expired_epoch,
                expiration_epoch: p.expiration,
              }));

              for (let i = 0; i < lifecycleRows.length; i += BATCH_SIZE) {
                const batch = lifecycleRows.slice(i, i + BATCH_SIZE);
                await supabase
                  .from('proposals')
                  .upsert(batch, { onConflict: 'tx_hash,proposal_index', ignoreDuplicates: false });
              }

              proposalCount = lifecycleRows.length;
              openProposals = bfProposals
                .filter(
                  (p: BlockfrostProposalDetail) =>
                    !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
                )
                .map((p: BlockfrostProposalDetail) => ({
                  txHash: p.tx_hash,
                  index: p.cert_index,
                }));

              warnings.push(`Koios failed (${koiosError}) — used Blockfrost fallback`);
              logger.info(`${TAG} Blockfrost fallback: updated ${proposalCount} proposals`, {
                open: openProposals.length,
              });
            } else {
              fatalErrors.push(
                `Proposals: Koios failed (${koiosError}), Blockfrost returned empty`,
              );
            }
          } else {
            fatalErrors.push(`Proposals: Koios failed (${koiosError}), Blockfrost unavailable`);
          }
        } catch (bfErr) {
          fatalErrors.push(
            `Proposals: Koios failed (${koiosError}), Blockfrost also failed (${errMsg(bfErr)})`,
          );
          logger.error(`${TAG} Both Koios and Blockfrost failed`, {
            koios: koiosError,
            blockfrost: errMsg(bfErr),
          });
        }
      }

      // --- Trigger the canonical incremental vote sync for open proposals ---
      if (openProposals.length > 0) {
        try {
          await inngest.send({
            name: 'drepscore/sync.votes',
            data: {
              source: 'sync.proposals',
              openProposalCount: openProposals.length,
            },
          });
          voteSyncsTriggered = 1;
          logger.info(`${TAG} Triggered incremental vote sync`, {
            openProposals: openProposals.length,
          });
        } catch (err) {
          warnings.push(`Vote sync trigger: ${errMsg(err)}`);
          logger.warn(`${TAG} Vote sync trigger failed (non-fatal)`, { error: errMsg(err) });
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

          if (summaryCount > 0)
            logger.info(`${TAG} Voting summaries refreshed`, { count: summaryCount });
        } catch (err) {
          logger.warn(`${TAG} Voting summary refresh error`, { error: errMsg(err) });
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
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://governada.io';
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
      fatalErrors.push(`Unhandled: ${errMsg(err)}`);
      logger.error(`${TAG} Unhandled error`, { error: errMsg(err) });
    }

    const allIssues = [...fatalErrors, ...warnings];
    const success = fatalErrors.length === 0;
    const metrics = {
      proposals_synced: proposalCount,
      vote_syncs_triggered: voteSyncsTriggered,
      summaries_refreshed: summaryCount,
      vote_snapshots: voteSnapshotCount,
      push_sent: pushSent,
      warning_count: warnings.length,
    };

    await syncLog.finalize(success, allIssues.length > 0 ? allIssues.join('; ') : null, metrics);
    await emitPostHog(success, 'proposals', syncLog.elapsed, metrics);

    if (!success) {
      throw new Error(fatalErrors.join('; '));
    }

    return {
      success,
      proposals: proposalCount,
      votesTriggered: voteSyncsTriggered,
      summariesRefreshed: summaryCount,
      voteSnapshots: voteSnapshotCount,
      pushSent,
      warnings: warnings.length,
      durationSeconds: (syncLog.elapsed / 1000).toFixed(1),
      timestamp: new Date().toISOString(),
    };
  });
}
