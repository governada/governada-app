/**
 * Inngest Function: sync-governance-benchmarks
 *
 * Runs weekly (Sunday 06:00 UTC) to fetch governance metrics from
 * Tally (Ethereum) and SubSquare (Polkadot), plus Cardano GHI data.
 * Stores snapshots in governance_benchmarks table.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import {
  fetchEthereumBenchmark,
  fetchPolkadotBenchmark,
  fetchCardanoBenchmark,
  computeGovernanceScore,
  computeGrade,
  type ChainBenchmark,
} from '@/lib/crossChain';

export const syncGovernanceBenchmarks = inngest.createFunction(
  {
    id: 'sync-governance-benchmarks',
    name: 'Sync Governance Benchmarks',
    retries: 2,
  },
  { cron: '0 6 * * 0' },
  async ({ step }) => {
    const enabled = await step.run('check-feature-flag', async () => {
      return getFeatureFlag('cross_chain_sync');
    });
    if (!enabled) {
      return { skipped: true, reason: 'cross_chain_sync flag is disabled' };
    }

    const cardano = await step.run('fetch-cardano', async () => {
      return fetchCardanoBenchmark();
    });

    const ethereum = await step.run('fetch-ethereum', async () => {
      return fetchEthereumBenchmark();
    });

    const polkadot = await step.run('fetch-polkadot', async () => {
      return fetchPolkadotBenchmark();
    });

    const results = await step.run('store-benchmarks', async () => {
      const supabase = getSupabaseAdmin();
      const stored: string[] = [];

      const benchmarks = [cardano, ethereum, polkadot].filter(Boolean) as Omit<ChainBenchmark, 'grade' | 'governanceScore'>[];

      for (const b of benchmarks) {
        const governanceScore = b.chain === 'cardano'
          ? (b.rawData as { ghiScore?: number })?.ghiScore ?? computeGovernanceScore({
              participationRate: b.participationRate,
              delegateCount: b.delegateCount,
              proposalThroughput: b.proposalThroughput,
              rationaleRate: b.avgRationaleRate,
            })
          : computeGovernanceScore({
              participationRate: b.participationRate,
              delegateCount: b.delegateCount,
              proposalThroughput: b.proposalThroughput,
              rationaleRate: b.avgRationaleRate,
            });

        const grade = computeGrade(governanceScore);

        const { error } = await supabase
          .from('governance_benchmarks')
          .upsert({
            chain: b.chain,
            period_label: b.periodLabel,
            participation_rate: b.participationRate,
            delegate_count: b.delegateCount,
            proposal_count: b.proposalCount,
            proposal_throughput: b.proposalThroughput,
            avg_rationale_rate: b.avgRationaleRate,
            governance_score: governanceScore,
            grade,
            raw_data: b.rawData,
            fetched_at: b.fetchedAt,
          }, { onConflict: 'chain,period_label' });

        if (error) {
          console.error(`[sync-benchmarks] Failed to store ${b.chain}:`, error.message);
        } else {
          stored.push(`${b.chain}: ${governanceScore} (${grade})`);
        }
      }

      return { stored, total: benchmarks.length };
    });

    console.log(`[sync-benchmarks] Stored ${results.stored.length}/${results.total} benchmarks:`, results.stored);
    return results;
  },
);
