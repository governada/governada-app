import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';

export const alertInbox = inngest.createFunction(
  {
    id: 'alert-inbox',
    retries: 2,
    triggers: { cron: '0 3,9,15,21 * * *' },
  },
  async ({ step }) => {
    return step.run('execute-inbox-alert', () => callSyncRoute('/api/admin/inbox-alert', 15_000));
  },
);
