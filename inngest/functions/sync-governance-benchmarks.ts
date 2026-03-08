/**
 * Inngest Function: sync-governance-benchmarks
 *
 * Runs weekly (Sunday 06:00 UTC) to fetch governance metrics from
 * Tally (Ethereum) and SubSquare (Polkadot), plus Cardano GHI data.
 * Stores snapshots in governance_benchmarks table.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';

import { generateText } from '@/lib/ai';
import { SyncLogger, errMsg, capMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import {
  fetchEthereumBenchmark,
  fetchPolkadotBenchmark,
  fetchCardanoBenchmark,
  type ChainBenchmark,
} from '@/lib/crossChain';

export const syncGovernanceBenchmarks = inngest.createFunction(
  {
    id: 'sync-governance-benchmarks',
    name: 'Sync Governance Benchmarks',
    retries: 3,
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[benchmarks] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'benchmarks')
        .is('finished_at', null);
    },
  },
  [{ cron: '0 6 * * 0' }, { event: 'drepscore/sync.benchmarks' }],
  async ({ step }) => {
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
      const syncLog = new SyncLogger(supabase, 'benchmarks');
      await syncLog.start();
      const stored: string[] = [];

      try {
        const benchmarks = [cardano, ethereum, polkadot].filter(Boolean) as ChainBenchmark[];

        for (const b of benchmarks) {
          const { error } = await supabase.from('governance_benchmarks').upsert(
            {
              chain: b.chain,
              period_label: b.periodLabel,
              participation_rate: b.participationRate,
              delegate_count: b.delegateCount,
              proposal_count: b.proposalCount,
              proposal_throughput: b.proposalThroughput,
              avg_rationale_rate: b.avgRationaleRate,
              governance_score: null,
              grade: null,
              raw_data: b.rawData,
              fetched_at: b.fetchedAt,
            },
            { onConflict: 'chain,period_label' },
          );

          if (error) {
            logger.error(`[sync-benchmarks] Failed to store ${b.chain}`, { error });
          } else {
            stored.push(b.chain);
          }
        }

        await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'benchmarks',
            epoch_no: 0,
            snapshot_date: new Date().toISOString().slice(0, 10),
            record_count: stored.length,
            expected_count: 3,
            coverage_pct: Math.round((stored.length / 3) * 10000) / 100,
            metadata: { chains: stored },
          },
          { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
        );

        const summary = { stored, total: benchmarks.length };
        await syncLog.finalize(true, null, summary as unknown as Record<string, unknown>);
        return summary;
      } catch (err) {
        await syncLog.finalize(false, errMsg(err), { stored });
        throw err;
      }
    });

    logger.info('[sync-benchmarks] Benchmarks stored', {
      stored: results.stored.length,
      total: results.total,
      chains: results.stored,
    });

    let aiInsight: string | null = null;

    aiInsight = await step.run('generate-ai-insight', async () => {
      const benchmarks = [cardano, ethereum, polkadot].filter(Boolean) as ChainBenchmark[];
      if (benchmarks.length < 2) return null;

      const metricsContext = benchmarks
        .map((b) => {
          const parts = [`${b.chain}:`];
          if (b.delegateCount != null) parts.push(`${b.delegateCount} delegates/DReps`);
          if (b.participationRate != null) parts.push(`${b.participationRate}% participation`);
          if (b.proposalCount != null) parts.push(`${b.proposalCount} proposals`);
          if (b.proposalThroughput != null) parts.push(`${b.proposalThroughput}% throughput`);
          if (b.avgRationaleRate != null) parts.push(`${b.avgRationaleRate}% rationale rate`);
          return parts.join(' ');
        })
        .join('\n');

      const prompt = `You are a neutral governance analyst. Given these metrics from blockchain governance systems, write ONE concise, factual observation (1-2 sentences) that highlights an interesting pattern or difference. Do not judge which is better. Do not favor any chain. Focus on what the data shows.\n\nMetrics:\n${metricsContext}`;

      try {
        return await generateText(prompt, {
          maxTokens: 200,
          temperature: 0.3,
          system:
            'You are a neutral, data-driven governance analyst. Output only the observation, no preamble.',
        });
      } catch (err) {
        logger.warn('[sync-benchmarks] AI insight failed, retrying once...', { error: err });
        await new Promise((r) => setTimeout(r, 3000));
        try {
          return await generateText(prompt, {
            maxTokens: 200,
            temperature: 0.3,
            system:
              'You are a neutral, data-driven governance analyst. Output only the observation, no preamble.',
          });
        } catch (retryErr) {
          logger.error('[sync-benchmarks] AI insight failed after retry', { error: retryErr });
          return null;
        }
      }
    });

    if (aiInsight) {
      await step.run('store-ai-insight', async () => {
        const supabase = getSupabaseAdmin();
        const benchmarks = [cardano, ethereum, polkadot].filter(Boolean) as ChainBenchmark[];
        for (const b of benchmarks) {
          await supabase
            .from('governance_benchmarks')
            .update({ ai_insight: aiInsight })
            .eq('chain', b.chain)
            .eq('period_label', b.periodLabel);
        }
      });
    }

    return { ...results, aiInsight };
  },
);
