/**
 * Generate Citizen Briefings — runs after epoch transition (triggered by
 * generate-epoch-summary), batch-generates personalized briefings for
 * active citizen users and stores them in governance_briefs.
 *
 * This enables push notifications with pre-computed content and faster
 * initial load of the Epoch Briefing component (cache hit instead of
 * on-the-fly generation).
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  assembleHolderBriefContext,
  generateAIHolderBrief,
  generateHolderBrief,
  storeBrief,
} from '@/lib/governanceBrief';
import { checkAndAwardCitizenMilestones } from '@/lib/citizenMilestones';
import { errMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

const USER_BATCH = 25;

export const generateCitizenBriefings = inngest.createFunction(
  {
    id: 'generate-citizen-briefings',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"citizen-briefings"' },
  },
  { event: 'drepscore/epoch.transition' },
  async ({ event, step }) => {
    const epoch = event.data?.epoch as number | undefined;
    if (!epoch) {
      logger.warn('[citizen-briefings] No epoch in event data');
      return { skipped: true, reason: 'no epoch' };
    }

    const users = await step.run('fetch-active-citizens', async () => {
      const supabase = getSupabaseAdmin();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('users')
        .select('id, wallet_address, delegation_history')
        .gte('last_visit_at', thirtyDaysAgo);

      if (error) {
        logger.error('[citizen-briefings] Failed to fetch users', { error });
        return [];
      }

      return (data ?? []).map((u) => ({
        id: u.id as string,
        wallet: u.wallet_address as string,
        drepId: extractDrepId(u.delegation_history),
      }));
    });

    if (users.length === 0) {
      return { skipped: true, reason: 'no active users' };
    }

    // Process users in batches to stay under Cloudflare 60s timeout
    let generated = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i += USER_BATCH) {
      const batchIndex = Math.floor(i / USER_BATCH);
      const batch = users.slice(i, i + USER_BATCH);

      const batchResult = await step.run(`generate-batch-${batchIndex}`, async () => {
        let batchGenerated = 0;
        let batchFailed = 0;

        for (const user of batch) {
          try {
            // Check if briefing already exists for this epoch
            const supabase = getSupabaseAdmin();
            const { data: existing } = await supabase
              .from('governance_briefs')
              .select('id')
              .eq('user_id', user.id)
              .eq('brief_type', 'citizen')
              .eq('epoch', epoch)
              .maybeSingle();

            if (existing) {
              batchGenerated++; // Already generated
              continue;
            }

            // Assemble context and generate
            const ctx = await assembleHolderBriefContext(user.id, user.drepId);

            if (!ctx) {
              batchFailed++;
              continue;
            }

            // Try AI generation for personalized headline; fall back to template
            let brief;
            try {
              brief = await generateAIHolderBrief(ctx);
            } catch {
              brief = generateHolderBrief(ctx);
            }
            await storeBrief(user.id, 'citizen', brief, epoch);

            // Award any new citizen milestones alongside briefing generation
            try {
              await checkAndAwardCitizenMilestones(user.id, user.drepId);
            } catch (milestoneErr) {
              logger.warn('[citizen-briefings] Milestone check failed', {
                userId: user.id,
                error: errMsg(milestoneErr),
              });
            }

            batchGenerated++;
          } catch (err) {
            logger.warn('[citizen-briefings] Failed for user', {
              userId: user.id,
              error: errMsg(err),
            });
            batchFailed++;
          }
        }

        return { generated: batchGenerated, failed: batchFailed };
      });

      generated += batchResult.generated;
      failed += batchResult.failed;
    }

    logger.info('[citizen-briefings] Completed', {
      epoch,
      totalUsers: users.length,
      generated,
      failed,
    });

    return { epoch, totalUsers: users.length, generated, failed };
  },
);

function extractDrepId(history: unknown): string | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const latest = history[history.length - 1];
  return typeof latest === 'object' && latest !== null && 'drepId' in latest
    ? (latest as { drepId: string }).drepId
    : null;
}
