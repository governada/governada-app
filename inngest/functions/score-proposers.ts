/**
 * Inngest: Score Proposers
 *
 * Resolves proposer identities from CIP-100 metadata, runs AI quality
 * assessment on proposal text, then computes scores for all proposers.
 * Runs daily after proposal sync completes.
 */

import { inngest } from '@/lib/inngest';
import {
  resolveAllProposers,
  scoreAllProposers,
  scoreProposalQuality,
  scoreBudgetQuality,
} from '@/lib/scoring/proposer';
import type { ProposalQualityInput, ProposalQualityResult } from '@/lib/scoring/proposer';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/** Maximum proposals to AI-score per run to control API costs */
const AI_BATCH_LIMIT = 200;
/** Concurrency for AI calls to avoid rate limiting */
const AI_CONCURRENCY = 5;

/**
 * Process items in batches with concurrency control.
 */
async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export const scoreProposers = inngest.createFunction(
  {
    id: 'score-proposers',
    name: 'Score Proposers',
    retries: 2,
    triggers: [{ cron: '0 3 * * *' }, { event: 'drepscore/sync.proposers' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inngest dual-trigger type inference
  async ({ step }: any) => {
    const resolution = await step.run('resolve-identities', async () => {
      const result = await resolveAllProposers();
      logger.info('[ScoreProposers] Identity resolution complete', result);
      return result;
    });

    // AI quality scoring step — score proposal text before computing proposer scores
    const aiResults = await step.run('ai-quality-scoring', async () => {
      const supabase = getSupabaseAdmin();

      // Fetch proposals that have text content worth scoring
      const { data: proposals } = await supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, proposal_type, title, abstract, meta_json, withdrawal_amount',
        )
        .or('abstract.neq.,meta_json->body.neq.')
        .limit(AI_BATCH_LIMIT);

      if (!proposals?.length) {
        logger.info('[ScoreProposers] No proposals with text content to AI-score');
        return { qualityScored: 0, budgetScored: 0, qualityMap: {}, budgetMap: {} };
      }

      const qualityMap: Record<string, ProposalQualityResult> = {};
      const budgetMap: Record<string, number> = {};

      // Prepare inputs
      const qualityInputs: { key: string; input: ProposalQualityInput }[] = [];
      const budgetInputs: {
        key: string;
        input: {
          title: string;
          abstract: string | null;
          body: string | null;
          withdrawalAmount: number | null;
          proposalType: string;
        };
      }[] = [];

      for (const p of proposals) {
        const key = `${p.tx_hash}-${p.proposal_index}`;
        const meta = p.meta_json as Record<string, unknown> | null;
        const body = meta?.body
          ? typeof meta.body === 'string'
            ? meta.body
            : JSON.stringify(meta.body)
          : null;
        const motivation = meta?.motivation
          ? typeof meta.motivation === 'string'
            ? meta.motivation
            : JSON.stringify(meta.motivation)
          : null;

        qualityInputs.push({
          key,
          input: {
            proposalType: p.proposal_type,
            title: p.title ?? '(untitled)',
            abstract: p.abstract,
            motivation,
            body,
          },
        });

        // Budget quality for treasury proposals
        if (p.proposal_type === 'TreasuryWithdrawals' && p.withdrawal_amount) {
          budgetInputs.push({
            key,
            input: {
              title: p.title ?? '(untitled)',
              abstract: p.abstract,
              body,
              withdrawalAmount: Number(p.withdrawal_amount),
              proposalType: p.proposal_type,
            },
          });
        }
      }

      // Score quality in parallel batches
      await processInBatches(qualityInputs, AI_CONCURRENCY, async ({ key, input }) => {
        try {
          const result = await scoreProposalQuality(input);
          if (result) {
            qualityMap[key] = result;
          }
        } catch (err) {
          logger.warn('[ScoreProposers] AI quality scoring failed for proposal', {
            key,
            error: err,
          });
        }
      });

      // Score budget quality in parallel batches
      await processInBatches(budgetInputs, AI_CONCURRENCY, async ({ key, input }) => {
        try {
          const result = await scoreBudgetQuality(input);
          if (result !== null) {
            budgetMap[key] = result;
          }
        } catch (err) {
          logger.warn('[ScoreProposers] AI budget scoring failed for proposal', {
            key,
            error: err,
          });
        }
      });

      logger.info('[ScoreProposers] AI scoring complete', {
        qualityScored: Object.keys(qualityMap).length,
        budgetScored: Object.keys(budgetMap).length,
        totalProposals: proposals.length,
      });

      return {
        qualityScored: Object.keys(qualityMap).length,
        budgetScored: Object.keys(budgetMap).length,
        qualityMap,
        budgetMap,
      };
    });

    const scoring = await step.run('score-proposers', async () => {
      // Reconstruct Maps from serialized step output
      const aiQualityMap = new Map<string, ProposalQualityResult>(
        Object.entries(aiResults.qualityMap ?? {}),
      );
      const budgetQualityMap = new Map<string, number>(Object.entries(aiResults.budgetMap ?? {}));

      const result = await scoreAllProposers(aiQualityMap, budgetQualityMap);
      logger.info('[ScoreProposers] Scoring complete', result);
      return result;
    });

    return {
      resolution,
      aiScoring: { qualityScored: aiResults.qualityScored, budgetScored: aiResults.budgetScored },
      scoring,
    };
  },
);
