import { inngest } from '@/lib/inngest';
import { executeDrepsSync } from '@/lib/sync/dreps';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncDreps = inngest.createFunction(
  {
    id: 'sync-dreps',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
  },
  [{ cron: '0 */6 * * *' }, { event: 'drepscore/sync.dreps' }],
  async ({ step }) => {
    const result = await step.run('execute-dreps-sync', () => executeDrepsSync());
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));

    // Trigger PCA alignment sync as a follow-on event
    await step.sendEvent('trigger-alignment-sync', {
      name: 'drepscore/sync.alignment',
      data: { triggeredBy: 'sync-dreps' },
    });

    return result;
  },
);
