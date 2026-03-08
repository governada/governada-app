import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { executeProposalsSync } from '@/lib/sync/proposals';
import { pingHeartbeat, errMsg, capMsg } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';
import { logger } from '@/lib/logger';

export const syncProposals = inngest.createFunction(
  {
    id: 'sync-proposals',
    retries: 3,
    concurrency: {
      limit: 2,
      scope: 'env',
      key: '"koios-frequent"',
    },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[proposals] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'proposals')
        .is('finished_at', null);
    },
  },
  [{ cron: '*/30 * * * *' }, { event: 'drepscore/sync.proposals' }],
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-proposals', '*/30 * * * *');
    try {
      const result = await step.run('execute-proposals-sync', () => executeProposalsSync());
      await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_PROPOSALS'));
      cronCheckOut('sync-proposals', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('sync-proposals', checkInId, false);
      throw error;
    }
  },
);
