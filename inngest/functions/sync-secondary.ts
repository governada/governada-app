import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { executeSecondarySync } from '@/lib/sync/secondary';
import { pingHeartbeat, errMsg, capMsg, alertCritical } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

export const syncSecondary = inngest.createFunction(
  {
    id: 'sync-secondary',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[secondary] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'secondary')
        .is('finished_at', null);
      await alertCritical(
        'Secondary Sync Failed',
        `Secondary sync failed after all retries.\nError: ${msg}\nCheck logs for details.`,
      );
    },
    triggers: [{ cron: '30 */6 * * *' }, { event: 'drepscore/sync.secondary' }],
  },
  async ({ step }) => {
    const result = await step.run('execute-secondary-sync', () => executeSecondarySync());
    await step.run('heartbeat-batch', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
    return result;
  },
);
