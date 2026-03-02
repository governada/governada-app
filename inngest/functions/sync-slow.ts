import { inngest } from '@/lib/inngest';
import { executeSlowSync } from '@/lib/sync/slow';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncSlow = inngest.createFunction(
  {
    id: 'sync-slow',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"slow-sync"' },
  },
  [{ cron: '0 4 * * *' }, { event: 'drepscore/sync.slow' }],
  async ({ step }) => {
    const result = await step.run('execute-slow-sync', () => executeSlowSync());
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_DAILY'));
    return result;
  },
);
