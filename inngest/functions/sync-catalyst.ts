/**
 * Catalyst Data Collection — daily sync of Project Catalyst data
 *
 * Streams (each as a separate Inngest step for durability):
 * 1. Sync Catalyst funds (14 rounds, lightweight)
 * 2. Sync proposals per-fund (each fund is a separate step to avoid timeout)
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { alertCritical, emitPostHog, errMsg, capMsg, SyncLogger } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';
import { syncCatalystFunds, syncCatalystProposals } from '@/lib/sync/catalyst';

export const syncCatalyst = inngest.createFunction(
  {
    id: 'sync-catalyst',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"catalyst"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[catalyst] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'catalyst')
        .is('finished_at', null);
    },
    triggers: [{ cron: '30 4 * * *' }, { event: 'drepscore/sync.catalyst' }],
  },
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-catalyst', '30 4 * * *');
    try {
      // Step 1: Sync funds — must come first (FK dependency)
      const fundResult = await step.run('sync-catalyst-funds', async () => {
        try {
          return await syncCatalystFunds();
        } catch (err) {
          logger.error('[catalyst] Fund sync failed', { error: err });
          return { fundsStored: 0, errors: [errMsg(err)] };
        }
      });

      // Step 2: Get fund IDs for per-fund proposal sync
      const fundIds = await step.run('get-fund-ids', async () => {
        const sb = getSupabaseAdmin();
        const { data } = await sb
          .from('catalyst_funds')
          .select('id')
          .order('id', { ascending: true });
        return (data || []).map((f) => f.id);
      });

      // Step 3: Sync proposals per fund (each fund is its own step to stay within timeout)
      let totalProposals = 0;
      let totalCampaigns = 0;
      let totalTeamMembers = 0;
      let totalTeamLinks = 0;
      const allErrors: string[] = [];

      for (const fundId of fundIds) {
        const result = await step.run(`sync-proposals-fund-${fundId}`, async () => {
          try {
            return await syncCatalystProposals(fundId);
          } catch (err) {
            const msg = errMsg(err);
            logger.error(`[catalyst] Fund ${fundId} proposal sync failed`, { error: msg });
            return {
              proposalsStored: 0,
              campaignsStored: 0,
              teamMembersStored: 0,
              teamLinksStored: 0,
              errors: [msg],
            };
          }
        });

        totalProposals += result.proposalsStored;
        totalCampaigns += result.campaignsStored;
        totalTeamMembers += result.teamMembersStored;
        totalTeamLinks += result.teamLinksStored;
        allErrors.push(...result.errors);
      }

      // Step 4: Write consolidated sync_log for catalyst_proposals
      await step.run('finalize-proposal-sync', async () => {
        const sb = getSupabaseAdmin();
        const syncLog = new SyncLogger(sb, 'catalyst_proposals');
        await syncLog.start();
        await syncLog.finalize(allErrors.length === 0, allErrors.join('; ') || null, {
          proposals_stored: totalProposals,
          campaigns_stored: totalCampaigns,
          team_members_stored: totalTeamMembers,
          team_links_stored: totalTeamLinks,
          funds_processed: fundIds.length,
        });
      });

      // Step 5: Emit analytics + alert on failures
      await step.run('emit-analytics', async () => {
        const combinedErrors = [...fundResult.errors, ...allErrors];

        await emitPostHog(combinedErrors.length === 0, 'catalyst', 0, {
          funds_stored: fundResult.fundsStored,
          proposals_stored: totalProposals,
          campaigns_stored: totalCampaigns,
          team_members_stored: totalTeamMembers,
          team_links_stored: totalTeamLinks,
          error_count: combinedErrors.length,
        });

        if (combinedErrors.length > 0) {
          await alertCritical(
            'Catalyst Sync Failures',
            `${combinedErrors.length} error(s):\n${combinedErrors.slice(0, 5).join('\n')}`,
          );
        }
      });

      cronCheckOut('sync-catalyst', checkInId, true);
      return {
        funds: fundResult,
        proposals: {
          proposalsStored: totalProposals,
          campaignsStored: totalCampaigns,
          teamMembersStored: totalTeamMembers,
          teamLinksStored: totalTeamLinks,
          errors: allErrors,
        },
      };
    } catch (error) {
      cronCheckOut('sync-catalyst', checkInId, false);
      throw error;
    }
  },
);
