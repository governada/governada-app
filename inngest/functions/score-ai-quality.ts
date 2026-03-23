/**
 * Inngest: AI Quality Scoring Pipeline
 *
 * Unified AI scoring pipeline that runs after data sync:
 *   1. Score unscored DRep rationales (quality + sub-dimensions + summaries)
 *   2. Score unscored proposal bodies (quality for Proposer Score)
 *   3. Generate GHI epoch narrative (if new snapshot exists)
 *
 * Runs daily at 02:30 UTC (after sync-slow, before proposer scoring at 03:00).
 */

import { inngest } from '@/lib/inngest';
import { scoreRationalesBatch } from '@/lib/alignment/rationaleQuality';
import { scoreProposalBodiesBatch } from '@/lib/ai/proposalQuality';
import { generateGHINarrative } from '@/lib/ai/ghiNarrative';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const scoreAiQuality = inngest.createFunction(
  {
    id: 'score-ai-quality',
    name: 'AI Quality Scoring Pipeline',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"ai-quality-scoring"' },
  },
  [{ cron: '30 2 * * *' }, { event: 'drepscore/sync.ai-quality' }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inngest dual-trigger type inference
  async ({ step }: any) => {
    // Step 1: Score unscored DRep rationales (batch of 100 per run)
    const rationaleResult = await step.run('score-drep-rationales', async () => {
      const supabase = getSupabaseAdmin();

      // Find rationales that need scoring: have text but no quality score,
      // OR have a score but no sub-dimensions (backfill)
      const { data: unscored } = await supabase
        .from('vote_rationales')
        .select('drep_id, proposal_tx_hash, proposal_index, rationale_text')
        .not('rationale_text', 'is', null)
        .limit(100);

      if (!unscored?.length) return { scored: 0 };

      // Get proposal titles for context
      const txHashes = [...new Set(unscored.map((r) => r.proposal_tx_hash))];
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title')
        .in('tx_hash', txHashes);

      const titleMap = new Map<string, string>();
      for (const p of proposals ?? []) {
        titleMap.set(`${p.tx_hash}-${p.proposal_index}`, p.title ?? '');
      }

      const inputs = unscored.map((r) => ({
        drepId: r.drep_id,
        proposalTxHash: r.proposal_tx_hash,
        proposalIndex: r.proposal_index,
        rationaleText: r.rationale_text,
        proposalTitle: titleMap.get(`${r.proposal_tx_hash}-${r.proposal_index}`) ?? undefined,
      }));

      const scores = await scoreRationalesBatch(inputs);
      return { scored: scores.size };
    });

    // Step 2: Score unscored proposal bodies (batch of 20 per run)
    const proposalResult = await step.run('score-proposal-bodies', async () => {
      const result = await scoreProposalBodiesBatch(20);
      return result;
    });

    // Step 3: Generate GHI epoch narrative
    const narrativeResult = await step.run('generate-ghi-narrative', async () => {
      const result = await generateGHINarrative();
      return result
        ? { epoch: result.epoch, changes: result.significantChanges.length }
        : { epoch: null, changes: 0 };
    });

    logger.info('[AI Quality Pipeline] Complete', {
      rationales: rationaleResult,
      proposals: proposalResult,
      narrative: narrativeResult,
    });

    return {
      rationaleResult,
      proposalResult,
      narrativeResult,
    };
  },
);
