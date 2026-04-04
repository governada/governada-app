import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';

export const generateSystemsReviewDraft = inngest.createFunction(
  {
    id: 'systems-weekly-review-draft',
    retries: 2,
    triggers: { cron: '15 13 * * 1' },
  },
  async ({ step }) => {
    return step.run('generate-systems-review-draft', () =>
      callSyncRoute('/api/admin/systems/review-draft', 20_000),
    );
  },
);
