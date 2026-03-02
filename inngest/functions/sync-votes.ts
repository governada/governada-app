import { inngest } from '@/lib/inngest';
import { executeVotesSync } from '@/lib/sync/votes';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncVotes = inngest.createFunction(
  {
    id: 'sync-votes',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
  },
  [{ cron: '15 */6 * * *' }, { event: 'drepscore/sync.votes' }],
  async ({ step }) => {
    const result = await step.run('execute-votes-sync', () => executeVotesSync());
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
    return result;
  },
);
