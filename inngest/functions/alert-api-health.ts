import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';

export const alertApiHealth = inngest.createFunction(
  {
    id: 'alert-api-health',
    retries: 2,
  },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    return step.run('execute-api-health-alert', () =>
      callSyncRoute('/api/admin/api-health/alert', 15_000),
    );
  },
);
