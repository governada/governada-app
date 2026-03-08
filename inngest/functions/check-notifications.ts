/**
 * Notification Checker — runs after every DRep sync to fire notifications.
 * Wires the 5 previously-untriggered types + 5 new DRep-specific types.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyUser, broadcastEvent, type NotificationEvent } from '@/lib/notifications';
import { blockTimeToEpoch } from '@/lib/koios';
import { checkAndAwardMilestones, MILESTONES } from '@/lib/milestones';
import { checkAndAwardCitizenMilestones, CITIZEN_MILESTONES } from '@/lib/citizenMilestones';
import { errMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

interface ClaimedUserRow {
  id: string;
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

interface CitizenDelegator {
  userId: string;
  drepId: string;
}

interface CitizenDRepRow {
  id: string;
  score: number;
  score_momentum: number | null;
  participation_rate: number | null;
}

const SCORE_CHANGE_THRESHOLD = 3;
const INACTIVITY_EPOCH_THRESHOLD = 3;
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
      citizenAlerts: 0,
      citizenMilestones: 0,
    };

    // Step 1: Gather claimed DReps and their data
    const context = await step.run('gather-claimed-dreps', async () => {
      const supabase = getSupabaseAdmin();

      const { data: users } = await supabase
        .from('users')
        .select('id, wallet_address, claimed_drep_id')
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
            await notifyUser(user.id, {
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
            await notifyUser(user.id, {
              eventType: 'delegation-change',
              title: `${delegatorDelta > 0 ? '+' : ''}${delegatorDelta} delegator${Math.abs(delegatorDelta) !== 1 ? 's' : ''}`,
              body: `You now have ${snapshots[0].delegator_count} delegators.`,
              url: `${BASE_URL}/dashboard`,
            });
            stats.delegation++;

            if (delegatorDelta > 0) {
              await notifyUser(user.id, {
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
          await notifyUser(user.id, {
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
            await notifyUser(user.id, {
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
              await notifyUser(user.id, {
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

    // Step 7: Tier change notifications (Phase A)
    await step.run('check-tier-changes', async () => {
      const supabase = getSupabaseAdmin();
      const { getFeatureFlag } = await import('@/lib/featureFlags');
      const tiersEnabled = await getFeatureFlag('score_tiers', false);
      if (!tiersEnabled) return;

      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { data: recentTierChanges } = await supabase
        .from('tier_changes')
        .select('entity_type, entity_id, old_tier, new_tier, new_score')
        .gte('created_at', oneDayAgo);

      if (!recentTierChanges?.length) return;

      for (const tc of recentTierChanges) {
        const isUp = tierRank(tc.new_tier) > tierRank(tc.old_tier);

        if (tc.entity_type === 'drep') {
          const user = context.users.find(
            (u: ClaimedUserRow) => u.claimed_drep_id === tc.entity_id,
          );
          if (user) {
            await notifyUser(user.id, {
              eventType: 'tier-change',
              title: `${isUp ? '🎉' : '⚠️'} Tier ${isUp ? 'up' : 'down'}: ${tc.old_tier} → ${tc.new_tier}`,
              body: `Your governance tier ${isUp ? 'rose' : 'dropped'} to ${tc.new_tier} (score: ${tc.new_score}).${isUp ? ' Share your achievement!' : ''}`,
              url: `${BASE_URL}/dashboard`,
            });
          }
        } else if (tc.entity_type === 'spo') {
          const { data: pool } = await supabase
            .from('pools')
            .select('claimed_by')
            .eq('pool_id', tc.entity_id)
            .single();
          if (pool?.claimed_by) {
            await notifyUser(pool.claimed_by, {
              eventType: 'spo-tier-change',
              title: `Pool tier ${isUp ? 'up' : 'down'}: ${tc.old_tier} → ${tc.new_tier}`,
              body: `Your pool's governance tier ${isUp ? 'rose' : 'dropped'} to ${tc.new_tier} (score: ${tc.new_score}).`,
              url: `${BASE_URL}/pool/${tc.entity_id}`,
            });
          }
        }
      }
    });

    // Step 8: Alignment drift notifications (Phase A)
    await step.run('check-alignment-drift', async () => {
      const supabase = getSupabaseAdmin();
      const { getFeatureFlag } = await import('@/lib/featureFlags');
      const driftEnabled = await getFeatureFlag('alignment_drift', false);
      if (!driftEnabled) return;

      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { data: recentDrifts } = await supabase
        .from('alignment_drift_records')
        .select('user_id, drep_id, drift_score, drift_classification')
        .gte('created_at', oneDayAgo)
        .in('drift_classification', ['moderate', 'high']);

      if (!recentDrifts?.length) return;

      for (const drift of recentDrifts) {
        const severity = drift.drift_classification === 'high' ? 'significantly' : 'noticeably';
        await notifyUser(drift.user_id, {
          eventType: 'alignment-drift',
          title: `Your DRep has ${severity} drifted from your values`,
          body: `Alignment drift score: ${drift.drift_score}. Review your delegation or explore alternatives.`,
          url: `${BASE_URL}/my-gov`,
        });
      }
    });

    // Step 9: Delegation milestone notifications (Phase A)
    await step.run('check-delegation-milestones', async () => {
      const supabase = getSupabaseAdmin();
      const milestoneThresholds = [100, 500, 1000, 5000];

      for (const user of context.users) {
        const drep = context.dreps.find((d: DRepRow) => d.id === user.claimed_drep_id);
        if (!drep) continue;

        const currentDelegators = (drep.info as { delegatorCount?: number })?.delegatorCount ?? 0;
        if (currentDelegators === 0) continue;

        const { data: snapshots } = await supabase
          .from('drep_power_snapshots')
          .select('delegator_count')
          .eq('drep_id', drep.id)
          .order('epoch_no', { ascending: false })
          .limit(2);

        if (!snapshots || snapshots.length < 2) continue;
        const previousDelegators = snapshots[1].delegator_count ?? 0;

        for (const threshold of milestoneThresholds) {
          if (currentDelegators >= threshold && previousDelegators < threshold) {
            await notifyUser(user.id, {
              eventType: 'delegation-milestone',
              title: `🎉 ${threshold.toLocaleString()} delegators!`,
              body: `You've reached ${threshold.toLocaleString()} delegators. Your governance voice represents a growing community.`,
              url: `${BASE_URL}/dashboard`,
            });
          }
        }
      }
    });

    // Step 10: SPO inactivity warnings (Phase A)
    await step.run('check-spo-inactivity', async () => {
      const supabase = getSupabaseAdmin();
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

      const { data: inactivePools } = await supabase
        .from('pools')
        .select('pool_id, pool_name, ticker')
        .gt('vote_count', 0)
        .lt('vote_count', 2);

      if (!inactivePools?.length) return;

      for (const pool of inactivePools) {
        const { data: lastVote } = await supabase
          .from('spo_votes')
          .select('epoch')
          .eq('pool_id', pool.pool_id)
          .order('epoch', { ascending: false })
          .limit(1)
          .single();

        if (!lastVote?.epoch) continue;
        const epochsSinceVote = currentEpoch - lastVote.epoch;
        if (epochsSinceVote < INACTIVITY_EPOCH_THRESHOLD) continue;

        const poolName = pool.pool_name || pool.ticker || pool.pool_id.slice(0, 12);
        await broadcastEvent({
          eventType: 'spo-inactivity',
          title: `Pool ${poolName} has been inactive for ${epochsSinceVote} epochs`,
          body: `This pool hasn't voted in ${epochsSinceVote} epochs. If you're staked here, check their governance commitment.`,
          url: `${BASE_URL}/pool/${pool.pool_id}`,
        });
      }
    });

    // Step 11: Competitive movement (Phase A)
    await step.run('check-competitive-movement', async () => {
      const supabase = getSupabaseAdmin();

      const { data: pools } = await supabase
        .from('pools')
        .select('pool_id, governance_score, claimed_by')
        .gt('vote_count', 0)
        .not('claimed_by', 'is', null)
        .order('governance_score', { ascending: false });

      if (!pools || pools.length < 3) return;

      for (let i = 1; i < pools.length; i++) {
        const current = pools[i];
        const above = pools[i - 1];

        const gap = (above.governance_score ?? 0) - (current.governance_score ?? 0);
        if (gap <= 3 && gap > 0 && current.claimed_by) {
          await notifyUser(current.claimed_by, {
            eventType: 'competitive-movement',
            title: `You're ${gap} point${gap !== 1 ? 's' : ''} from overtaking a competitor`,
            body: `A few more governance actions could move your pool up in the rankings.`,
            url: `${BASE_URL}/pool/${current.pool_id}`,
          });
        }
      }
    });

    // ── Citizen Alerts (Steps 12-14) ──────────────────────────────────────────
    // Target delegating citizens (NOT DRep operators) with alerts about their
    // representative's performance, inactivity, and citizen milestones.

    // Step 12: Gather citizen delegators
    const citizenContext = await step.run('gather-citizen-delegators', async () => {
      const supabase = getSupabaseAdmin();

      // Get users with active delegation who are NOT DRep operators
      const { data: wallets } = await supabase
        .from('user_wallets')
        .select('user_id, drep_id')
        .not('drep_id', 'is', null);

      if (!wallets || wallets.length === 0)
        return { citizens: [] as CitizenDelegator[], citizenDreps: [] as CitizenDRepRow[] };

      // Exclude users who already have claimed_drep_id (they get operator alerts)
      const claimedUserIds = new Set(context.users.map((u: ClaimedUserRow) => u.id));
      const citizenWallets = wallets.filter((w) => !claimedUserIds.has(w.user_id));

      if (citizenWallets.length === 0)
        return { citizens: [] as CitizenDelegator[], citizenDreps: [] as CitizenDRepRow[] };

      // Deduplicate by user_id (a user might have multiple wallets)
      const citizenMap = new Map<string, string>();
      for (const w of citizenWallets) {
        if (w.drep_id && !citizenMap.has(w.user_id)) {
          citizenMap.set(w.user_id, w.drep_id);
        }
      }

      const citizens: CitizenDelegator[] = Array.from(citizenMap.entries()).map(
        ([userId, drepId]) => ({ userId, drepId }),
      );

      // Fetch DRep data for these citizens' DReps
      const drepIds = [...new Set(citizens.map((c) => c.drepId))];
      const { data: dreps } = await supabase
        .from('dreps')
        .select('id, score, score_momentum, participation_rate')
        .in('id', drepIds);

      return {
        citizens,
        citizenDreps: (dreps || []) as CitizenDRepRow[],
      };
    });

    // Step 13: Citizen DRep health alerts
    await step.run('check-citizen-drep-alerts', async () => {
      const { citizens, citizenDreps } = citizenContext;
      if (citizens.length === 0) return;

      const supabase = getSupabaseAdmin();
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

      for (const citizen of citizens) {
        const drep = citizenDreps.find((d: CitizenDRepRow) => d.id === citizen.drepId);
        if (!drep) continue;

        // DRep score dropped significantly
        const { data: history } = await supabase
          .from('drep_score_history')
          .select('score')
          .eq('drep_id', citizen.drepId)
          .order('snapshot_date', { ascending: false })
          .limit(2);

        if (history && history.length >= 2) {
          const delta = history[0].score - history[1].score;
          if (delta < -SCORE_CHANGE_THRESHOLD) {
            await notifyUser(citizen.userId, {
              eventType: 'drep-score-change',
              title: `Your DRep's score dropped ${Math.abs(delta)} points`,
              body: `Their score is now ${history[0].score}/100. Consider reviewing their recent activity.`,
              url: `${BASE_URL}/drep/${citizen.drepId}`,
            });
            stats.citizenAlerts++;
          }
        }

        // DRep hasn't voted — check for inactivity or missed votes
        if (context.proposals.length > 0) {
          const { count } = await supabase
            .from('drep_votes')
            .select('vote_tx_hash', { count: 'exact', head: true })
            .eq('drep_id', citizen.drepId)
            .eq('epoch_no', currentEpoch);

          if ((count ?? 0) === 0) {
            const { data: lastVote } = await supabase
              .from('drep_votes')
              .select('epoch_no')
              .eq('drep_id', citizen.drepId)
              .order('epoch_no', { ascending: false })
              .limit(1)
              .maybeSingle();

            const epochsSinceVote = lastVote ? currentEpoch - (lastVote.epoch_no ?? 0) : 999;

            if (epochsSinceVote >= INACTIVITY_EPOCH_THRESHOLD) {
              await notifyUser(citizen.userId, {
                eventType: 'drep-inactive',
                title: `Your DRep hasn't voted in ${epochsSinceVote} epochs`,
                body: `Your representative has been inactive. Your delegation isn't being used.`,
                url: `${BASE_URL}/drep/${citizen.drepId}`,
              });
              stats.citizenAlerts++;
            } else if (epochsSinceVote >= 1) {
              await notifyUser(citizen.userId, {
                eventType: 'drep-missed-vote',
                title: `Your DRep missed voting this epoch`,
                body: `${context.proposals.length} proposal${context.proposals.length !== 1 ? 's were' : ' was'} open but your DRep didn't vote.`,
                url: `${BASE_URL}/drep/${citizen.drepId}`,
              });
              stats.citizenAlerts++;
            }
          }
        }
      }
    });

    // Step 14: Citizen milestone detection
    await step.run('check-citizen-milestones', async () => {
      const { citizens } = citizenContext;
      if (citizens.length === 0) return;

      for (const citizen of citizens) {
        try {
          const newMilestones = await checkAndAwardCitizenMilestones(
            citizen.userId,
            citizen.drepId,
          );

          for (const key of newMilestones) {
            const def = CITIZEN_MILESTONES.find((m) => m.key === key);
            if (def) {
              await notifyUser(citizen.userId, {
                eventType: 'citizen-level-up',
                title: `Achievement unlocked: ${def.label}`,
                body: def.description,
                url: `${BASE_URL}/my-gov`,
              });
              stats.citizenMilestones++;
            }
          }
        } catch (e) {
          logger.warn(`[notifications] Citizen milestone check failed for ${citizen.userId}`, {
            error: e,
          });
        }
      }
    });

    // Step 15: Engagement outcome notifications
    // When a proposal a citizen signaled on reaches conclusion, notify them.
    await step.run('check-engagement-outcomes', async () => {
      const supabase = getSupabaseAdmin();
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

      // Find proposals that were resolved this epoch (ratified, expired, or dropped)
      const { data: resolvedProposals } = await supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, ratified_epoch, expired_epoch, dropped_epoch',
        )
        .or(
          `ratified_epoch.eq.${currentEpoch},expired_epoch.eq.${currentEpoch},dropped_epoch.eq.${currentEpoch}`,
        );

      if (!resolvedProposals || resolvedProposals.length === 0) return;

      for (const proposal of resolvedProposals) {
        const outcome =
          proposal.ratified_epoch === currentEpoch
            ? 'ratified'
            : proposal.dropped_epoch === currentEpoch
              ? 'dropped'
              : 'expired';

        // Find citizens who voted sentiment on this proposal
        const { data: sentimentVoters } = await supabase
          .from('citizen_sentiment')
          .select('user_id, sentiment')
          .eq('proposal_tx_hash', proposal.tx_hash)
          .eq('proposal_index', proposal.proposal_index);

        if (!sentimentVoters || sentimentVoters.length === 0) continue;

        const proposalTitle = proposal.title || proposal.proposal_type || 'A governance proposal';
        const proposalUrl = `${BASE_URL}/proposal/${proposal.tx_hash}/${proposal.proposal_index}`;

        // Deduplicate by user_id
        const notifiedUsers = new Set<string>();

        for (const voter of sentimentVoters) {
          if (notifiedUsers.has(voter.user_id)) continue;
          notifiedUsers.add(voter.user_id);

          const sentimentLabel =
            voter.sentiment === 'support'
              ? 'supported'
              : voter.sentiment === 'oppose'
                ? 'opposed'
                : 'weighed in on';

          const outcomeEmoji =
            outcome === 'ratified' ? '\u2705' : outcome === 'dropped' ? '\u274C' : '\u23F3';

          await notifyUser(voter.user_id, {
            eventType: 'engagement-outcome',
            title: `${outcomeEmoji} Proposal you ${sentimentLabel} was ${outcome}`,
            body: proposalTitle,
            url: proposalUrl,
          });
          stats.citizenAlerts++;
        }
      }
    });

    return { stats };
  },
);

function tierRank(tier: string): number {
  const ranks: Record<string, number> = {
    Emerging: 0,
    Bronze: 1,
    Silver: 2,
    Gold: 3,
    Diamond: 4,
    Legendary: 5,
  };
  return ranks[tier] ?? 0;
}
