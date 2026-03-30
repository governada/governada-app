import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { executeVotesSync } from '@/lib/sync/votes';
import { pingHeartbeat, errMsg, capMsg, alertCritical } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';
import { logger } from '@/lib/logger';

/** Maximum time for the votes sync step before aborting (30 minutes). */
const VOTES_SYNC_TIMEOUT_MS = 30 * 60 * 1000;

export const syncVotes = inngest.createFunction(
  {
    id: 'sync-votes',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[votes] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'votes')
        .is('finished_at', null);
      await alertCritical(
        'Votes Sync Failed',
        `Votes sync failed after all retries.\nError: ${msg}\nCheck logs for details.`,
      );
    },
    triggers: [{ cron: '15 */6 * * *' }, { event: 'drepscore/sync.votes' }],
  },
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-votes', '15 */6 * * *');
    try {
      const result = await step.run('execute-votes-sync', async () => {
        // Guard against Koios hangs that cause 24h+ sync durations.
        // Abort after 30 minutes — the next scheduled run will pick up.
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Votes sync timed out after ${VOTES_SYNC_TIMEOUT_MS / 60000}m`)),
            VOTES_SYNC_TIMEOUT_MS,
          ),
        );
        return Promise.race([executeVotesSync(), timeout]);
      });
      await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
      cronCheckOut('sync-votes', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('sync-votes', checkInId, false);
      throw error;
    }
  },
);
