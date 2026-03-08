import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { executeDrepsSync } from '@/lib/sync/dreps';
import { pingHeartbeat, errMsg, capMsg } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';
import { logger } from '@/lib/logger';

export const syncDreps = inngest.createFunction(
  {
    id: 'sync-dreps',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[dreps] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'dreps')
        .is('finished_at', null);
    },
  },
  [{ cron: '0 */6 * * *' }, { event: 'drepscore/sync.dreps' }],
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-dreps', '0 */6 * * *');
    try {
      const result = await step.run('execute-dreps-sync', () => executeDrepsSync());
      await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));

      // Trigger PCA alignment sync and DRep Score V3 as follow-on events
      await step.sendEvent('trigger-follow-on-syncs', [
        {
          name: 'drepscore/sync.alignment',
          data: { triggeredBy: 'sync-dreps' },
        },
        {
          name: 'drepscore/sync.scores',
          data: { triggeredBy: 'sync-dreps' },
        },
      ]);

      cronCheckOut('sync-dreps', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('sync-dreps', checkInId, false);
      throw error;
    }
  },
);
