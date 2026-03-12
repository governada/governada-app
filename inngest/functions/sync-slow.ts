import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { executeSlowSync } from '@/lib/sync/slow';
import { pingHeartbeat, errMsg, capMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

export const syncSlow = inngest.createFunction(
  {
    id: 'sync-slow',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"slow-sync"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[slow] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'slow')
        .is('finished_at', null);
    },
  },
  [{ cron: '0 4 * * *' }, { event: 'drepscore/sync.slow' }],
  async ({ step }) => {
    const result = await step.run('execute-slow-sync', () => executeSlowSync());
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_DAILY'));
    return result;
  },
);
