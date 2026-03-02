import { inngest } from '@/lib/inngest';
import { executeSecondarySync } from '@/lib/sync/secondary';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncSecondary = inngest.createFunction(
  {
    id: 'sync-secondary',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
  },
  [{ cron: '30 */6 * * *' }, { event: 'drepscore/sync.secondary' }],
  async ({ step }) => {
    const result = await step.run('execute-secondary-sync', () => executeSecondarySync());
    await step.run('heartbeat-batch', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
    return result;
  },
);
