import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';

export const alertApiHealth = inngest.createFunction(
  {
    id: 'alert-api-health',
    retries: 2,
    triggers: { cron: '*/15 * * * *' },
  },
  async ({ step }) => {
    const checkInId = cronCheckIn('alert-api-health', '*/15 * * * *');
    try {
      const result = await step.run('execute-api-health-alert', () =>
        callSyncRoute('/api/admin/api-health/alert', 15_000),
      );
      cronCheckOut('alert-api-health', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('alert-api-health', checkInId, false);
      throw error;
    }
  },
);
