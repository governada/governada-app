/**
 * Pre-compute citizen epoch summaries for all authenticated users.
 * Runs after epoch recap generation so epoch data is available.
 * Results are cached in citizen_epoch_summaries for fast API reads.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { calculateImpactScore, persistImpactScore } from '@/lib/citizenImpactScore';
import { checkAndAwardCitizenMilestones, CITIZEN_MILESTONES } from '@/lib/citizenMilestones';
import { notifyUser } from '@/lib/notifications';
import { captureServerEvent } from '@/lib/posthog-server';

export const precomputeCitizenSummaries = inngest.createFunction(
  {
    id: 'precompute-citizen-summaries',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"citizen-summaries"' },
    triggers: [{ event: 'drepscore/sync.scores.complete' }, { cron: '30 4 * * *' }],
  },
  async ({ step }) => {
    const result = await step.run('compute-summaries', async () => {
      const supabase = getSupabaseAdmin();

      const { data: statsRow } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();

      const currentEpoch =
        statsRow?.current_epoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));
      const targetEpoch = currentEpoch - 1;

      const { data: users } = await supabase
        .from('users')
        .select('id, wallet_address, claimed_drep_id')
        .not('claimed_drep_id', 'is', null);

      if (!users?.length)
        return {
          computed: 0,
          epoch: targetEpoch,
          userList: [] as { id: string; drepId: string | null }[],
        };

      const { data: recap } = await supabase
        .from('epoch_recaps')
        .select('proposals_submitted, proposals_ratified, treasury_withdrawn_ada')
        .eq('epoch', targetEpoch)
        .single();

      let computed = 0;
      const BATCH_SIZE = 50;

      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        const summaries = [];

        for (const user of batch) {
          const drepId = user.claimed_drep_id;
          let drepVotesCast = 0;
          let drepScore: number | null = null;
          let drepTier: string | null = null;

          if (drepId) {
            const { count } = await supabase
              .from('drep_votes')
              .select('vote_tx_hash', { count: 'exact', head: true })
              .eq('drep_id', drepId)
              .eq('epoch_no', targetEpoch);
            drepVotesCast = count ?? 0;

            const { data: snapshot } = await supabase
              .from('drep_score_history')
              .select('score')
              .eq('drep_id', drepId)
              .eq('epoch_no', targetEpoch)
              .single();
            drepScore = snapshot?.score ?? null;

            const { data: drep } = await supabase
              .from('dreps')
              .select('current_tier')
              .eq('id', drepId)
              .single();
            drepTier = drep?.current_tier ?? null;
          }

          summaries.push({
            user_id: user.id,
            epoch_no: targetEpoch,
            delegated_drep_id: drepId,
            drep_votes_cast: drepVotesCast,
            drep_score_at_epoch: drepScore,
            drep_tier_at_epoch: drepTier,
            proposals_voted_on: recap?.proposals_submitted ?? 0,
            treasury_allocated_lovelace: recap?.treasury_withdrawn_ada
              ? Math.round(recap.treasury_withdrawn_ada)
              : 0,
            summary_json: {
              proposalsSubmitted: recap?.proposals_submitted ?? 0,
              proposalsRatified: recap?.proposals_ratified ?? 0,
            },
          });
        }

        if (summaries.length > 0) {
          const { error } = await supabase
            .from('citizen_epoch_summaries')
            .upsert(summaries, { onConflict: 'user_id,epoch_no' });
          if (error) {
            logger.error('[citizen-summaries] Batch upsert failed', { error: error.message });
          } else {
            computed += summaries.length;
          }
        }
      }

      return {
        computed,
        epoch: targetEpoch,
        userList: users.map((u) => ({ id: u.id, drepId: u.claimed_drep_id })),
      };
    });

    // Step 2: Compute impact scores for all users
    const impactResult = await step.run('compute-impact-scores', async () => {
      const userList = result.userList ?? [];
      let scored = 0;

      for (const user of userList) {
        try {
          const breakdown = await calculateImpactScore(user.id, user.drepId);
          await persistImpactScore(user.id, breakdown);
          scored++;
        } catch (e) {
          logger.warn('[citizen-summaries] Impact score failed for user', {
            userId: user.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return { scored };
    });

    // Step 3: Check milestones and send notifications
    const milestoneResult = await step.run('check-milestones', async () => {
      const userList = result.userList ?? [];
      let totalNew = 0;

      for (const user of userList) {
        try {
          const newKeys = await checkAndAwardCitizenMilestones(user.id, user.drepId);

          if (newKeys.length > 0) {
            totalNew += newKeys.length;

            // Send notification for each new milestone
            for (const key of newKeys) {
              const def = CITIZEN_MILESTONES.find((m) => m.key === key);
              if (!def) continue;

              await notifyUser(user.id, {
                eventType: 'delegation-milestone',
                title: `Milestone Earned: ${def.label}`,
                body: def.description,
                url: '/you/identity',
                metadata: { milestoneKey: key, category: def.category },
              });

              captureServerEvent(
                'citizen_milestone_earned',
                {
                  milestoneKey: key,
                  category: def.category,
                },
                user.id,
              );
            }
          }
        } catch (e) {
          logger.warn('[citizen-summaries] Milestone check failed for user', {
            userId: user.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return { newMilestones: totalNew };
    });

    return {
      computed: result.computed,
      epoch: result.epoch,
      impactScoresComputed: impactResult.scored,
      newMilestones: milestoneResult.newMilestones,
    };
  },
);
