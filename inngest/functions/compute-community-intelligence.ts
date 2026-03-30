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
    triggers: { cron: '*/30 * * * *' },
  },
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

    // Step 4: Aggregate match preference signals into community pulse
    const matchPreferencesResult = await step.run('aggregate-match-signals', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = getSupabaseAdmin();

      // Fetch all match_signal snapshots for this epoch
      const { data: signals, error: fetchError } = await supabase
        .from('community_intelligence_snapshots')
        .select('data')
        .eq('snapshot_type', 'match_signal')
        .eq('epoch', epoch);

      if (fetchError || !signals || signals.length === 0) {
        return { stored: false, sessions: 0 };
      }

      // Aggregate topic frequency
      const topicFrequency: Record<string, number> = {};
      const archetypeDistribution: Record<string, number> = {};
      const importanceProfile: Record<string, Record<string, number>> = {};
      const alignmentSums = [0, 0, 0, 0, 0, 0];
      let alignmentCount = 0;

      for (const row of signals) {
        const d = row.data as {
          topicSelections?: Record<string, boolean>;
          importanceWeights?: Record<string, string>;
          alignmentVector?: number[];
          archetype?: string;
        };

        // Topic selections
        if (d.topicSelections) {
          for (const [topic, selected] of Object.entries(d.topicSelections)) {
            if (selected) {
              topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
            }
          }
        }

        // Archetype
        if (d.archetype) {
          archetypeDistribution[d.archetype] = (archetypeDistribution[d.archetype] || 0) + 1;
        }

        // Alignment vector centroid
        if (d.alignmentVector && d.alignmentVector.length === 6) {
          for (let i = 0; i < 6; i++) {
            alignmentSums[i] += d.alignmentVector[i];
          }
          alignmentCount++;
        }

        // Importance weights
        if (d.importanceWeights) {
          for (const [dim, level] of Object.entries(d.importanceWeights)) {
            if (!importanceProfile[dim]) importanceProfile[dim] = {};
            importanceProfile[dim][level] = (importanceProfile[dim][level] || 0) + 1;
          }
        }
      }

      // Compute community centroid
      const communityCentroid =
        alignmentCount > 0
          ? alignmentSums.map((sum) => Math.round(sum / alignmentCount))
          : [50, 50, 50, 50, 50, 50];

      // Compute topic trends vs previous epoch
      const { data: prevSnapshot } = await supabase
        .from('community_intelligence_snapshots')
        .select('data')
        .eq('snapshot_type', 'match_preferences')
        .eq('epoch', epoch - 1)
        .single();

      const prevTopicFreq =
        (prevSnapshot?.data as { topicFrequency?: Record<string, number> } | null)
          ?.topicFrequency ?? {};

      const topicTrends: Record<string, number> = {};
      for (const topic of Object.keys(topicFrequency)) {
        topicTrends[topic] = topicFrequency[topic] - (prevTopicFreq[topic] ?? 0);
      }

      const aggregated = {
        epoch,
        totalSessions: signals.length,
        topicFrequency,
        topicTrends,
        archetypeDistribution,
        communityCentroid,
        importanceProfile,
      };

      const stored = await storeCommunitySnapshot(
        'match_preferences',
        epoch,
        aggregated as unknown as Record<string, unknown>,
      );

      return { stored, sessions: signals.length };
    });

    logger.info('[CommunityIntelligence] Computation complete', {
      epoch,
      mandate: mandateResult,
      divergence: divergenceResult,
      temperature: temperatureResult,
      matchPreferences: matchPreferencesResult,
    });

    return {
      epoch,
      mandate: mandateResult,
      divergence: divergenceResult,
      temperature: temperatureResult,
      matchPreferences: matchPreferencesResult,
    };
  },
);
