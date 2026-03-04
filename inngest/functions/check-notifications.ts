/**
 * Notification Checker — runs after every DRep sync to fire notifications.
 * Wires the 5 previously-untriggered types + 5 new DRep-specific types.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyUser, broadcastEvent, type NotificationEvent } from '@/lib/notifications';
import { blockTimeToEpoch } from '@/lib/koios';
import { checkAndAwardMilestones, MILESTONES } from '@/lib/milestones';
import { errMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

interface ClaimedUserRow {
  wallet_address: string;
  claimed_drep_id: string | null;
}

interface DRepRow {
  id: string;
  score: number;
  info: Record<string, unknown>;
  effective_participation: number | null;
  rationale_rate: number | null;
  reliability_score: number | null;
  profile_completeness: number | null;
}

interface OpenProposalRow {
  tx_hash: string;
  proposal_index: number;
  proposal_type: string;
  title: string | null;
  expiration_epoch: number | null;
}

interface DRepScoreRow {
  id: string;
  score: number;
}

const SCORE_CHANGE_THRESHOLD = 3;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://drepscore.io';

export const checkNotifications = inngest.createFunction(
  {
    id: 'check-notifications',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"notifications"' },
  },
  { cron: '15 */6 * * *' },
  async ({ step }) => {
    const stats = {
      scoreChange: 0,
      delegation: 0,
      pending: 0,
      urgent: 0,
      milestone: 0,
      rank: 0,
      opportunity: 0,
    };

    // Step 1: Gather claimed DReps and their data
    const context = await step.run('gather-claimed-dreps', async () => {
      const supabase = getSupabaseAdmin();

      const { data: users } = await supabase
        .from('users')
        .select('wallet_address, claimed_drep_id')
        .not('claimed_drep_id', 'is', null);

      if (!users || users.length === 0)
        return {
          users: [] as ClaimedUserRow[],
          dreps: [] as DRepRow[],
          proposals: [] as OpenProposalRow[],
          allDreps: [] as DRepScoreRow[],
        };

      const drepIds = users.map((u) => u.claimed_drep_id).filter(Boolean);

      const [drepsResult, proposalsResult] = await Promise.all([
        supabase
          .from('dreps')
          .select(
            'id, score, info, effective_participation, rationale_rate, reliability_score, profile_completeness',
          )
          .in('id', drepIds),
        supabase
          .from('proposals')
          .select('tx_hash, proposal_index, proposal_type, title, expiration_epoch')
          .is('ratified_epoch', null)
          .is('enacted_epoch', null)
          .is('dropped_epoch', null)
          .is('expired_epoch', null),
      ]);

      // Get all dreps for ranking
      const { data: allDreps } = await supabase
        .from('dreps')
        .select('id, score')
        .not('info->isActive', 'eq', false)
        .order('score', { ascending: false });

      return {
        users: users || [],
        dreps: drepsResult.data || [],
        proposals: proposalsResult.data || [],
        allDreps: allDreps || [],
      };
    });

    if (context.users.length === 0) return { stats };

    // Step 2: Check score changes and delegation changes
    await step.run('check-score-and-delegation', async () => {
      const supabase = getSupabaseAdmin();

      for (const user of context.users) {
        const drep = context.dreps.find((d: DRepRow) => d.id === user.claimed_drep_id);
        if (!drep) continue;

        // Score change: check last score history entry
        const { data: history } = await supabase
          .from('drep_score_history')
          .select('score')
          .eq('drep_id', drep.id)
          .order('snapshot_date', { ascending: false })
          .limit(2);

        if (history && history.length >= 2) {
          const delta = history[0].score - history[1].score;
          if (Math.abs(delta) >= SCORE_CHANGE_THRESHOLD) {
            await notifyUser(user.wallet_address, {
              eventType: 'score-change',
              title: `Score ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)} points`,
              body: `Your DRepScore is now ${history[0].score}/100.`,
              url: `${BASE_URL}/dashboard`,
            });
            stats.scoreChange++;
          }
        }

        // Delegation change
        const { data: snapshots } = await supabase
          .from('drep_power_snapshots')
          .select('delegator_count')
          .eq('drep_id', drep.id)
          .order('epoch_no', { ascending: false })
          .limit(2);

        if (
          snapshots &&
          snapshots.length >= 2 &&
          snapshots[0].delegator_count != null &&
          snapshots[1].delegator_count != null
        ) {
          const delegatorDelta = snapshots[0].delegator_count - snapshots[1].delegator_count;
          if (delegatorDelta !== 0) {
            await notifyUser(user.wallet_address, {
              eventType: 'delegation-change',
              title: `${delegatorDelta > 0 ? '+' : ''}${delegatorDelta} delegator${Math.abs(delegatorDelta) !== 1 ? 's' : ''}`,
              body: `You now have ${snapshots[0].delegator_count} delegators.`,
              url: `${BASE_URL}/dashboard`,
            });
            stats.delegation++;

            if (delegatorDelta > 0) {
              await notifyUser(user.wallet_address, {
                eventType: 'delegator-growth',
                title: `You gained ${delegatorDelta} delegator${delegatorDelta !== 1 ? 's' : ''}`,
                body: `Your delegation is growing — ${snapshots[0].delegator_count} total delegators.`,
                url: `${BASE_URL}/dashboard`,
              });
            }
          }
        }
      }
    });

    // Step 3: Check pending proposals and deadlines
    await step.run('check-proposals', async () => {
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
      const openProposals = context.proposals;

      if (openProposals.length > 0) {
        await broadcastEvent({
          eventType: 'pending-proposals',
          title: `${openProposals.length} proposals awaiting votes`,
          body: `There are ${openProposals.length} open governance proposals.`,
          url: `${BASE_URL}/dashboard/inbox`,
        });
        stats.pending++;
      }

      const urgentProposals = openProposals.filter((p: OpenProposalRow) => {
        if (!p.expiration_epoch) return false;
        return p.expiration_epoch - currentEpoch <= 2;
      });

      if (urgentProposals.length > 0) {
        await broadcastEvent({
          eventType: 'urgent-deadline',
          title: `${urgentProposals.length} proposal${urgentProposals.length !== 1 ? 's' : ''} expiring soon`,
          body: `These proposals expire within 2 epochs. Vote now.`,
          url: `${BASE_URL}/dashboard/inbox`,
        });

        for (const user of context.users) {
          await notifyUser(user.wallet_address, {
            eventType: 'proposal-deadline',
            title: `${urgentProposals.length} proposal${urgentProposals.length !== 1 ? 's' : ''} expire in 2 epochs`,
            body: 'Vote now to maintain your participation rate.',
            url: `${BASE_URL}/dashboard/inbox`,
          });
        }
        stats.urgent++;
      }
    });

    // Step 4: Check rank changes and score opportunities
    await step.run('check-rank-and-opportunities', async () => {
      const allDreps = context.allDreps || [];

      for (const user of context.users) {
        const drep = context.dreps.find((d: DRepRow) => d.id === user.claimed_drep_id);
        if (!drep) continue;

        const rank = allDreps.findIndex((d: DRepScoreRow) => d.id === drep.id) + 1;
        if (rank <= 0) continue;

        // Near top 10 opportunity
        if (rank > 10 && rank <= 15 && allDreps.length >= 10) {
          const distance = allDreps[9].score - drep.score;
          if (distance <= 5) {
            await notifyUser(user.wallet_address, {
              eventType: 'score-opportunity',
              title: `You're ${distance} point${distance !== 1 ? 's' : ''} from the top 10`,
              body: `Ranked #${rank} — a few more rationales could push you into the top 10.`,
              url: `${BASE_URL}/dashboard`,
            });
            stats.opportunity++;
          }
        }
      }
    });

    // Step 5: Check milestones for near-milestone notifications
    await step.run('check-near-milestones', async () => {
      const supabase = getSupabaseAdmin();

      for (const user of context.users) {
        const drep = context.dreps.find((d: DRepRow) => d.id === user.claimed_drep_id);
        if (!drep) continue;

        try {
          const newMilestones = await checkAndAwardMilestones(drep.id);

          for (const key of newMilestones) {
            const def = MILESTONES.find((m) => m.key === key);
            if (def) {
              await notifyUser(user.wallet_address, {
                eventType: 'near-milestone',
                title: `Achievement unlocked: ${def.label}`,
                body: def.description,
                url: `${BASE_URL}/dashboard`,
              });
              stats.milestone++;
            }
          }
        } catch (e) {
          logger.warn(`[notifications] Milestone check failed for ${drep.id}`, { error: e });
        }
      }
    });

    // Step 6: Treasury health alerts and new withdrawal proposals
    await step.run('check-treasury-alerts', async () => {
      const supabase = getSupabaseAdmin();

      const { data: latestSnapshot } = await supabase
        .from('treasury_snapshots')
        .select('epoch_no, balance_lovelace')
        .order('epoch_no', { ascending: false })
        .limit(2);

      if (latestSnapshot && latestSnapshot.length >= 2) {
        const current = Number(BigInt(latestSnapshot[0].balance_lovelace) / BigInt(1_000_000));
        const previous = Number(BigInt(latestSnapshot[1].balance_lovelace) / BigInt(1_000_000));
        const pctChange = ((current - previous) / previous) * 100;

        if (pctChange < -5) {
          await broadcastEvent({
            eventType: 'treasury-health-alert',
            title: 'Treasury balance dropped significantly',
            body: `Treasury declined ${Math.abs(pctChange).toFixed(1)}% this epoch. Current balance: ${(current / 1_000_000).toFixed(1)}M ADA.`,
            url: `${BASE_URL}/treasury`,
          });
        }
      }

      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
      const { data: newTreasuryProposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, withdrawal_amount, treasury_tier')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .eq('proposed_epoch', currentEpoch);

      for (const p of newTreasuryProposals || []) {
        if (p.treasury_tier === 'major' || p.treasury_tier === 'significant') {
          await broadcastEvent({
            eventType: 'treasury-proposal-new',
            title: `New ${p.treasury_tier} treasury proposal`,
            body: `"${p.title || 'Untitled'}" requests ${(p.withdrawal_amount || 0).toLocaleString()} ADA from the treasury.`,
            url: `${BASE_URL}/proposals/${p.tx_hash}/${p.proposal_index}`,
          });
        }
      }

      const { data: openPolls } = await supabase
        .from('treasury_accountability_polls')
        .select('proposal_tx_hash, proposal_index, cycle_number')
        .eq('status', 'open')
        .eq('opened_epoch', currentEpoch);

      for (const poll of openPolls || []) {
        await broadcastEvent({
          eventType: 'treasury-accountability-open',
          title: 'Treasury accountability poll opened',
          body: `Cycle ${poll.cycle_number} accountability poll is now open. Rate whether this treasury spending delivered.`,
          url: `${BASE_URL}/proposals/${poll.proposal_tx_hash}/${poll.proposal_index}`,
        });
      }
    });

    return { stats };
  },
);
