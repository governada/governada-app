/**
 * Catalyst Data Collection — daily sync of Project Catalyst data
 *
 * Streams (each as a separate Inngest step for durability):
 * 1. Sync Catalyst funds (14 rounds, lightweight)
 * 2. Sync all proposals with campaigns and team members
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { alertCritical, emitPostHog, errMsg, capMsg } from '@/lib/sync-utils';
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
  },
  [{ cron: '30 4 * * *' }, { event: 'drepscore/sync.catalyst' }],
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

      // Step 2: Sync all proposals (includes campaigns + team members)
      const proposalResult = await step.run('sync-catalyst-proposals', async () => {
        try {
          return await syncCatalystProposals();
        } catch (err) {
          logger.error('[catalyst] Proposal sync failed', { error: err });
          return {
            proposalsStored: 0,
            campaignsStored: 0,
            teamMembersStored: 0,
            teamLinksStored: 0,
            errors: [errMsg(err)],
          };
        }
      });

      // Step 3: Emit analytics + alert on failures
      await step.run('emit-analytics', async () => {
        const allErrors = [...fundResult.errors, ...proposalResult.errors];

        await emitPostHog(allErrors.length === 0, 'catalyst', 0, {
          funds_stored: fundResult.fundsStored,
          proposals_stored: proposalResult.proposalsStored,
          campaigns_stored: proposalResult.campaignsStored,
          team_members_stored: proposalResult.teamMembersStored,
          team_links_stored: proposalResult.teamLinksStored,
          error_count: allErrors.length,
        });

        if (allErrors.length > 0) {
          await alertCritical(
            'Catalyst Sync Failures',
            `${allErrors.length} error(s):\n${allErrors.join('\n')}`,
          );
        }
      });

      cronCheckOut('sync-catalyst', checkInId, true);
      return {
        funds: fundResult,
        proposals: proposalResult,
      };
    } catch (error) {
      cronCheckOut('sync-catalyst', checkInId, false);
      throw error;
    }
  },
);
