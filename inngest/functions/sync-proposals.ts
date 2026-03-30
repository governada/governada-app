import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { executeProposalsSync } from '@/lib/sync/proposals';
import { pingHeartbeat, errMsg, capMsg, alertCritical } from '@/lib/sync-utils';
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
      const errorName =
        error && typeof error === 'object'
          ? (error as unknown as Record<string, unknown>).name
          : undefined;
      const detail = msg || errorName || JSON.stringify(error);
      logger.error('[proposals] Function failed permanently', { error: detail });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${detail}`),
        })
        .eq('sync_type', 'proposals')
        .is('finished_at', null);
      await alertCritical(
        'Proposals Sync Failed',
        `Proposals sync failed after all retries.\nError: ${detail || msg}\nCheck logs for details.`,
      );
    },
    triggers: [{ cron: '*/30 * * * *' }, { event: 'drepscore/sync.proposals' }],
  },
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
