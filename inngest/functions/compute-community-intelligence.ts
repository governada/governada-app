/**
 * Inngest Function: compute-community-intelligence
 *
 * Runs every 30 minutes to precompute community intelligence metrics:
 * - Citizen Mandate (priority rankings — already handled by engagement signals job)
 * - Sentiment Divergence Index
 * - Governance Temperature
 *
 * Results are stored in `community_intelligence_snapshots` for fast reads.
 * All features are gated by feature flags — this job always runs to collect
 * data, but the data is only surfaced when flags are enabled.
 */

import { inngest } from '@/lib/inngest';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import {
  computeSentimentDivergence,
  computeGovernanceTemperature,
  getCitizenMandate,
  storeCommunitySnapshot,
} from '@/lib/communityIntelligence';

export const computeCommunityIntelligence = inngest.createFunction(
  {
    id: 'compute-community-intelligence',
    name: 'Compute Community Intelligence',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"community-intelligence"' },
  },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const epoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Step 1: Compute and store mandate snapshot
    const mandateResult = await step.run('compute-mandate', async () => {
      const mandate = await getCitizenMandate(epoch);
      if (!mandate || mandate.totalVoters === 0) {
        return { stored: false, voters: 0 };
      }

      const stored = await storeCommunitySnapshot(
        'mandate',
        epoch,
        mandate as unknown as Record<string, unknown>,
      );
      return { stored, voters: mandate.totalVoters };
    });

    // Step 2: Compute and store divergence snapshot
    const divergenceResult = await step.run('compute-divergence', async () => {
      const divergence = await computeSentimentDivergence(epoch);
      if (!divergence || divergence.proposals.length === 0) {
        return { stored: false, proposals: 0, aggregate: 0 };
      }

      const stored = await storeCommunitySnapshot(
        'divergence',
        epoch,
        divergence as unknown as Record<string, unknown>,
      );
      return {
        stored,
        proposals: divergence.proposals.length,
        aggregate: divergence.aggregateDivergence,
      };
    });

    // Step 3: Compute and store temperature snapshot
    const temperatureResult = await step.run('compute-temperature', async () => {
      const temperature = await computeGovernanceTemperature(epoch);
      if (!temperature) {
        return { stored: false, temperature: 0 };
      }

      const stored = await storeCommunitySnapshot(
        'temperature',
        epoch,
        temperature as unknown as Record<string, unknown>,
      );
      return { stored, temperature: temperature.temperature, band: temperature.band };
    });

    logger.info('[CommunityIntelligence] Computation complete', {
      epoch,
      mandate: mandateResult,
      divergence: divergenceResult,
      temperature: temperatureResult,
    });

    return {
      epoch,
      mandate: mandateResult,
      divergence: divergenceResult,
      temperature: temperatureResult,
    };
  },
);
