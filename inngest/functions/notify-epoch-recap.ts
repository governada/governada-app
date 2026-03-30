/**
 * Epoch Recap Notifications — generates personalized epoch digests
 * and sends them to opted-in users via email.
 *
 * Triggered after DRep scores sync. Generates epoch summary notifications
 * for all users with digest_frequency matching the current cadence.
 */

import React from 'react';
import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { notifyUser } from '@/lib/notifications';
import { sendEmail, generateUnsubscribeUrl } from '@/lib/email';
import { logger } from '@/lib/logger';
import { captureServerEvent } from '@/lib/posthog-server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://governada.io';

export const notifyEpochRecap = inngest.createFunction(
  {
    id: 'notify-epoch-recap',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"epoch-recap"' },
    triggers: { event: 'drepscore/sync.scores' },
  },
  async ({ step }) => {
    const supabase = getSupabaseAdmin();

    const flagEnabled = await step.run('check-flag', async () => {
      const { data } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'governance_wrapped')
        .single();
      return data?.enabled ?? false;
    });
    if (!flagEnabled) return { skipped: true };

    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Gather epoch-level stats
    const epochStats = await step.run('gather-epoch-stats', async () => {
      const [proposalsResult, recapResult] = await Promise.all([
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .or(
            `ratified_epoch.eq.${currentEpoch - 1},expired_epoch.eq.${currentEpoch - 1},dropped_epoch.eq.${currentEpoch - 1}`,
          ),
        supabase
          .from('epoch_recaps')
          .select('proposals_submitted, proposals_ratified, treasury_withdrawn_ada')
          .eq('epoch', currentEpoch - 1)
          .maybeSingle(),
      ]);

      // Count active proposals
      const { count: activeCount } = await supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null);

      return {
        proposalsDecided: proposalsResult.count ?? 0,
        proposalsSubmitted: recapResult.data?.proposals_submitted ?? 0,
        proposalsRatified: recapResult.data?.proposals_ratified ?? 0,
        treasuryWithdrawnAda: recapResult.data?.treasury_withdrawn_ada ?? 0,
        activeProposals: activeCount ?? 0,
      };
    });

    // Find opted-in users and generate personalized digests
    const digestResult = await step.run('generate-digests', async () => {
      // Get users who opted in for epoch digests
      const { data: prefs } = await supabase
        .from('user_notification_preferences')
        .select('user_id, email, digest_frequency')
        .in('digest_frequency', ['epoch', 'weekly']);

      if (!prefs?.length) {
        logger.info('[epoch-recap] No opted-in users found');
        return { queued: 0, emailed: 0 };
      }

      // Filter: weekly users only get notified on Mondays
      const isMonday = new Date().getDay() === 1;
      const eligiblePrefs = prefs.filter(
        (p) => p.digest_frequency === 'epoch' || (p.digest_frequency === 'weekly' && isMonday),
      );

      if (eligiblePrefs.length === 0) {
        return { queued: 0, emailed: 0 };
      }

      let queued = 0;
      let emailed = 0;

      for (const pref of eligiblePrefs) {
        try {
          // Get user's delegated DRep info
          const { data: wallet } = await supabase
            .from('user_wallets')
            .select('drep_id')
            .eq('user_id', pref.user_id)
            .limit(1)
            .maybeSingle();

          let drepName = 'Your DRep';
          let drepScore = 0;
          let drepTier = 'Emerging';
          let drepVotesCast = 0;
          let drepParticipationRate = 0;

          if (wallet?.drep_id) {
            const { data: drep } = await supabase
              .from('dreps')
              .select('info, score, current_tier, participation_rate')
              .eq('id', wallet.drep_id)
              .single();

            if (drep) {
              const info = (drep.info || {}) as Record<string, unknown>;
              drepName =
                (info.givenName as string) || (info.name as string) || wallet.drep_id.slice(0, 12);
              drepScore = drep.score ?? 0;
              drepTier = drep.current_tier ?? 'Emerging';
              drepParticipationRate = Math.round((drep.participation_rate ?? 0) * 100);
            }

            // Count votes this epoch
            const { count } = await supabase
              .from('drep_votes')
              .select('vote_tx_hash', { count: 'exact', head: true })
              .eq('drep_id', wallet.drep_id)
              .eq('epoch_no', currentEpoch - 1);
            drepVotesCast = count ?? 0;
          }

          // Get active proposals for the digest
          const { data: activeProposals } = await supabase
            .from('proposals')
            .select('tx_hash, proposal_index, title, expiration_epoch')
            .is('ratified_epoch', null)
            .is('enacted_epoch', null)
            .is('dropped_epoch', null)
            .is('expired_epoch', null)
            .order('proposed_epoch', { ascending: false })
            .limit(4);

          // Check for new milestones
          const stakeAddr = (
            await supabase
              .from('user_wallets')
              .select('stake_address')
              .eq('user_id', pref.user_id)
              .limit(1)
              .maybeSingle()
          ).data?.stake_address;

          let newMilestones: string[] = [];
          if (stakeAddr) {
            const oneDayAgo = new Date(Date.now() - 5 * 86400 * 1000).toISOString();
            const { data: milestoneNotifs } = await supabase
              .from('notifications')
              .select('title')
              .eq('user_stake_address', stakeAddr)
              .in('type', ['citizen-level-up', 'near-milestone'])
              .gte('created_at', oneDayAgo);
            newMilestones = (milestoneNotifs || []).map((n) => n.title);
          }

          const adaGoverned =
            epochStats.treasuryWithdrawnAda > 0
              ? `${(epochStats.treasuryWithdrawnAda / 1_000_000).toFixed(1)}M`
              : '0';

          // Fetch AI headline from governance_briefs if available
          let aiHeadline: string | undefined;
          const { data: brief } = await supabase
            .from('governance_briefs')
            .select('content_json')
            .eq('user_id', pref.user_id)
            .eq('epoch', currentEpoch - 1)
            .maybeSingle();
          if (brief?.content_json) {
            const content = brief.content_json as { headline?: string };
            if (content.headline) aiHeadline = content.headline;
          }

          // Fetch check-in streak
          let checkinStreak: number | undefined;
          if (stakeAddr) {
            const { data: checkins } = await supabase
              .from('user_hub_checkins')
              .select('epoch')
              .eq('user_stake_address', stakeAddr)
              .order('epoch', { ascending: false })
              .limit(20);
            if (checkins?.length) {
              let streak = 1;
              for (let ci = 1; ci < checkins.length; ci++) {
                const gap = checkins[ci - 1].epoch - checkins[ci].epoch;
                if (gap <= 2) streak++;
                else break;
              }
              checkinStreak = streak;
            }
          }

          // Create inbox notification
          await notifyUser(pref.user_id, {
            eventType: 'governance-brief',
            title: `Epoch ${currentEpoch - 1} Summary`,
            body: `${epochStats.proposalsDecided} proposals decided. Your DRep cast ${drepVotesCast} votes.`,
            url: `${BASE_URL}/`,
            metadata: {
              epoch: currentEpoch - 1,
              proposalsDecided: epochStats.proposalsDecided,
              drepVotes: drepVotesCast,
            },
          });
          queued++;

          // Send email if verified
          if (pref.email) {
            const { data: user } = await supabase
              .from('users')
              .select('email_verified')
              .eq('id', pref.user_id)
              .single();

            if (user?.email_verified) {
              try {
                const EpochDigest = (await import('@/emails/EpochDigest')).default;
                const unsubscribeUrl = generateUnsubscribeUrl(pref.user_id);

                const emailSubject = aiHeadline
                  ? `Epoch ${currentEpoch - 1}: ${aiHeadline}`
                  : `Epoch ${currentEpoch - 1}: ${epochStats.proposalsDecided} proposals decided`;

                const sent = await sendEmail(
                  pref.email,
                  emailSubject,
                  React.createElement(EpochDigest, {
                    epoch: currentEpoch - 1,
                    proposalsDecided: epochStats.proposalsDecided,
                    adaGoverned,
                    drepName,
                    drepVotesCast,
                    drepParticipationRate,
                    drepScore: Math.round(drepScore),
                    drepTier,
                    newMilestones,
                    activeProposals: (activeProposals || []).map((p) => ({
                      title: p.title || 'Untitled Proposal',
                      txHash: p.tx_hash,
                      index: p.proposal_index,
                      daysRemaining: p.expiration_epoch
                        ? Math.max(0, (p.expiration_epoch - currentEpoch) * 5)
                        : null,
                    })),
                    unsubscribeUrl,
                    aiHeadline,
                    checkinStreak,
                  }),
                  {
                    unsubscribeUrl,
                    tags: [
                      { name: 'type', value: 'epoch-digest' },
                      { name: 'epoch', value: String(currentEpoch - 1) },
                    ],
                  },
                );

                if (sent) emailed++;
              } catch (emailErr) {
                logger.warn('[epoch-recap] Email send failed', {
                  userId: pref.user_id,
                  error: emailErr instanceof Error ? emailErr.message : emailErr,
                });
              }
            }
          }
        } catch (err) {
          logger.warn('[epoch-recap] Failed to process user', {
            userId: pref.user_id,
            error: err instanceof Error ? err.message : err,
          });
        }
      }

      return { queued, emailed };
    });

    captureServerEvent('digest_sent', {
      epoch: currentEpoch - 1,
      queued: digestResult.queued,
      emailed: digestResult.emailed,
    });

    logger.info('[epoch-recap] Epoch recap complete', {
      epoch: currentEpoch - 1,
      ...digestResult,
    });

    return { epoch: currentEpoch - 1, ...digestResult };
  },
);
