/**
 * Inngest Function: generate-governance-brief
 *
 * Runs weekly (Monday 10:00 UTC) to generate personalized governance briefs
 * for all active users and deliver via the notification engine.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  assembleDRepBriefContext,
  assembleHolderBriefContext,
  generateDRepBrief,
  generateHolderBrief,
  generateAIDRepBrief,
  generateAIHolderBrief,
  storeBrief,
} from '@/lib/governanceBrief';
import { notifyUser } from '@/lib/notifications';
import { captureServerEvent } from '@/lib/posthog-server';

const BATCH_SIZE = 50;

export const generateGovernanceBrief = inngest.createFunction(
  {
    id: 'generate-governance-brief',
    name: 'Generate Governance Brief',
    retries: 2,
  },
  { cron: '0 10 * * 1' },
  async ({ step }) => {
    const activeUsers = await step.run('fetch-active-users', async () => {
      const supabase = getSupabaseAdmin();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data } = await supabase
        .from('users')
        .select('wallet_address, claimed_drep_id, delegation_history, digest_frequency')
        .gte('last_active', thirtyDaysAgo)
        .neq('digest_frequency', 'off');

      return (data ?? []).map((u) => ({
        wallet: u.wallet_address,
        claimedDrepId: u.claimed_drep_id as string | null,
        currentDrepId: (() => {
          const history = u.delegation_history as Array<{ drepId: string }> | null;
          return history?.length ? history[history.length - 1].drepId : null;
        })(),
        digestFrequency: (u.digest_frequency as string) || 'weekly',
      }));
    });

    if (activeUsers.length === 0) return { generated: 0, delivered: 0 };

    let generated = 0;
    let delivered = 0;

    for (let i = 0; i < activeUsers.length; i += BATCH_SIZE) {
      const batch = activeUsers.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE);

      const result = await step.run(`process-batch-${batchIndex}`, async () => {
        let batchGenerated = 0;
        let batchDelivered = 0;

        for (const user of batch) {
          try {
            const isDRep = !!user.claimedDrepId;
            let brief;

            if (isDRep && user.claimedDrepId) {
              const ctx = await assembleDRepBriefContext(user.claimedDrepId, user.wallet);
              if (!ctx) continue;
              brief = await generateAIDRepBrief(ctx);
              await storeBrief(user.wallet, 'drep', brief, ctx.epoch);
            } else {
              const ctx = await assembleHolderBriefContext(user.wallet, user.currentDrepId);
              brief = await generateAIHolderBrief(ctx);
              await storeBrief(user.wallet, 'holder', brief, ctx.epoch);
            }

            batchGenerated++;

            captureServerEvent(
              'governance_brief_generated',
              {
                user_type: isDRep ? 'drep' : 'holder',
                drep_id: user.claimedDrepId,
                brief_type: isDRep ? 'drep' : 'holder',
              },
              user.wallet,
            );

            await notifyUser(user.wallet, {
              eventType: 'governance-brief',
              fallback: {
                title: 'Your Weekly Governance Brief',
                body: brief.greeting,
                url: '/dashboard',
              },
              data: {
                briefType: isDRep ? 'drep' : 'holder',
                greeting: brief.greeting,
                sections: brief.sections,
                ctaText: brief.ctaText,
                ctaUrl: brief.ctaUrl,
              },
            });

            batchDelivered++;

            captureServerEvent(
              'governance_brief_delivered',
              {
                brief_type: isDRep ? 'drep' : 'holder',
              },
              user.wallet,
            );
          } catch (err) {
            console.error(`[GovernanceBrief] Failed for ${user.wallet}:`, err);
          }
        }

        return { generated: batchGenerated, delivered: batchDelivered };
      });

      generated += result.generated;
      delivered += result.delivered;
    }

    console.log(
      `[GovernanceBrief] Complete: ${generated} generated, ${delivered} delivered for ${activeUsers.length} users`,
    );
    return { generated, delivered, totalUsers: activeUsers.length };
  },
);
