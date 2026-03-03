/**
 * Inngest Function: generate-state-of-governance
 *
 * Runs on epoch boundaries (approximately every 5 days, Sunday 20:00 UTC)
 * to generate the State of Governance report — the canonical weekly artifact.
 */

import { inngest } from '@/lib/inngest';
import { getFeatureFlag } from '@/lib/featureFlags';
import { generateAndStoreReport } from '@/lib/stateOfGovernance';

export const generateStateOfGovernance = inngest.createFunction(
  {
    id: 'generate-state-of-governance',
    name: 'Generate State of Governance Report',
    retries: 2,
  },
  { cron: '0 20 * * 0' },
  async ({ step }) => {
    const [aiEnabled, reportsEnabled] = await step.run('check-flags', async () => {
      return Promise.all([
        getFeatureFlag('ai_state_of_governance'),
        getFeatureFlag('state_of_governance_reports'),
      ]);
    });
    if (!aiEnabled || !reportsEnabled) {
      return { skipped: true, reason: 'Feature flag disabled' };
    }
    const result = await step.run('generate-report', async () => {
      return generateAndStoreReport();
    });

    console.log(`[StateOfGovernance] Report for epoch ${result.epoch}: stored=${result.stored}`);
    return result;
  },
);
