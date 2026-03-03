import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';

export const alertIntegrity = inngest.createFunction(
  {
    id: 'alert-integrity',
    retries: 2,
  },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    return step.run('execute-integrity-alert', () =>
      callSyncRoute('/api/admin/integrity/alert', 60_000),
    );
  },
);
