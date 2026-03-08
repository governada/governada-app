/**
 * Track Proposal Outcomes — WP-12
 *
 * Runs daily to compute delivery status for all enacted treasury proposals
 * by aggregating accountability poll responses into outcome scores.
 *
 * Schedule: Daily at 01:00 UTC (after accountability polls run at 23:00 UTC)
 */

import { inngest } from '@/lib/inngest';
import { computeAllProposalOutcomes } from '@/lib/proposalOutcomes';
import { captureServerEvent } from '@/lib/posthog-server';
import { blockTimeToEpoch } from '@/lib/koios';

export const trackProposalOutcomes = inngest.createFunction(
  {
    id: 'track-proposal-outcomes',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"proposal-outcomes"' },
  },
  { cron: '0 1 * * *' },
  async ({ step }) => {
    const result = await step.run('compute-outcomes', () => computeAllProposalOutcomes());

    if (result.updated > 0) {
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
      captureServerEvent('proposal_outcomes_computed', {
        epoch: currentEpoch,
        evaluated: result.evaluated,
        updated: result.updated,
      });
    }

    return result;
  },
);
