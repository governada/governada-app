import { inngest } from '@/lib/inngest';
import { executeDrepsSync } from '@/lib/sync/dreps';
import { pingHeartbeat } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';

export const syncDreps = inngest.createFunction(
  {
    id: 'sync-dreps',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
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
