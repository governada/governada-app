import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';

export const runSystemsAutomationSweep = inngest.createFunction(
  {
    id: 'systems-automation-daily-sweep',
    retries: 2,
    triggers: { cron: '0 13 * * *' },
  },
  async ({ step }) => {
    return step.run('run-systems-automation-sweep', () =>
      callSyncRoute('/api/admin/systems/automation', 20_000),
    );
  },
);
