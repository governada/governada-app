import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';

export const alertIntegrity = inngest.createFunction(
  {
    id: 'alert-integrity',
    retries: 2,
    triggers: { cron: '10 */6 * * *' }, // Offset to :10 to avoid :00 collision
  },
  async ({ step }) => {
    const checkInId = cronCheckIn('alert-integrity', '10 */6 * * *');
    try {
      const result = await step.run('execute-integrity-alert', () =>
        callSyncRoute('/api/admin/integrity/alert', 60_000),
      );
      cronCheckOut('alert-integrity', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('alert-integrity', checkInId, false);
      throw error;
    }
  },
);
