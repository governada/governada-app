import { inngest } from '@/lib/inngest';
import {
  assembleProposalBriefInput,
  generateProposalBrief,
  storeProposalBrief,
  computeRationaleHash,
  getProposalBrief,
  isBriefStale,
} from '@/lib/proposalBrief';
import { MODELS } from '@/lib/ai';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * On-demand brief generation — triggered by API route or other events.
 */
export const generateProposalBriefOnDemand = inngest.createFunction(
  {
    id: 'generate-proposal-brief-on-demand',
    name: 'Generate Proposal Brief (On-Demand)',
    retries: 2,
    concurrency: { limit: 5 },
  },
  { event: 'governada/proposal.brief.generate' },
  async ({ event, step }) => {
    const { txHash, proposalIndex } = event.data as { txHash: string; proposalIndex: number };

    const result = await step.run('generate-brief', async () => {
      const startMs = Date.now();

      const input = await assembleProposalBriefInput(txHash, proposalIndex);
      if (!input) {
        return { status: 'skipped', reason: 'no_proposal_data' };
      }

      if (input.rationales.length < 3) {
        return {
          status: 'skipped',
          reason: 'insufficient_rationales',
          count: input.rationales.length,
        };
      }

      // Check if current brief is already fresh
      const existing = await getProposalBrief(txHash, proposalIndex);
      const currentHash = computeRationaleHash(input.rationales);
      if (existing && !isBriefStale(existing, currentHash)) {
        return { status: 'skipped', reason: 'already_fresh' };
      }

      const brief = await generateProposalBrief(input);
      const generationTimeMs = Date.now() - startMs;

      await storeProposalBrief(
        txHash,
        proposalIndex,
        brief,
        input.convictionScore,
        input.polarizationScore,
        currentHash,
        input.rationales.length,
        MODELS.FAST,
        generationTimeMs,
      );

      captureServerEvent('proposal_brief_generated', {
        tx_hash: txHash,
        proposal_index: proposalIndex,
        rationale_count: input.rationales.length,
        generation_time_ms: generationTimeMs,
        is_ai: brief.sections.length >= 4,
      });

      return {
        status: 'generated',
        rationaleCount: input.rationales.length,
        sectionCount: brief.sections.length,
        generationTimeMs,
      };
    });

    return result;
  },
);

/**
 * Batch brief generation — runs every 6 hours.
 * Finds proposals with 3+ rationales that need brief generation or updates.
 */
export const generateProposalBriefsBatch = inngest.createFunction(
  {
    id: 'generate-proposal-briefs-batch',
    name: 'Generate Proposal Briefs (Batch)',
    retries: 1,
    concurrency: { limit: 1 },
  },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    // Find proposals with 3+ rationales
    const proposals = await step.run('find-proposals-needing-briefs', async () => {
      const supabase = getSupabaseAdmin();

      // Find proposals that have rationales
      const { data: proposalsWithRationales } = await supabase
        .from('vote_rationales')
        .select('vote_tx_hash')
        .not('rationale_text', 'is', null);

      if (!proposalsWithRationales || proposalsWithRationales.length === 0) return [];

      // Get unique vote tx hashes and find their proposals
      const voteTxHashes = [...new Set(proposalsWithRationales.map((r) => r.vote_tx_hash))];

      const { data: votes } = await supabase
        .from('drep_votes')
        .select('proposal_tx_hash, proposal_index')
        .in('vote_tx_hash', voteTxHashes);

      if (!votes) return [];

      // Count rationales per proposal
      const proposalCounts = new Map<string, { txHash: string; index: number; count: number }>();
      for (const v of votes) {
        const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
        const existing = proposalCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          proposalCounts.set(key, {
            txHash: v.proposal_tx_hash,
            index: v.proposal_index,
            count: 1,
          });
        }
      }

      // Filter to 3+ rationales
      return [...proposalCounts.values()].filter((p) => p.count >= 3).slice(0, 50); // Cap at 50 per batch to limit AI costs
    });

    if (proposals.length === 0) {
      return { processed: 0, generated: 0, skipped: 0 };
    }

    let generated = 0;
    let skipped = 0;

    // Process in batches of 5
    for (let i = 0; i < proposals.length; i += 5) {
      const batch = proposals.slice(i, i + 5);
      const batchIndex = Math.floor(i / 5);

      const result = await step.run(`process-batch-${batchIndex}`, async () => {
        let batchGenerated = 0;
        let batchSkipped = 0;

        for (const p of batch) {
          try {
            const input = await assembleProposalBriefInput(p.txHash, p.index);
            if (!input || input.rationales.length < 3) {
              batchSkipped++;
              continue;
            }

            const existing = await getProposalBrief(p.txHash, p.index);
            const currentHash = computeRationaleHash(input.rationales);
            if (existing && !isBriefStale(existing, currentHash)) {
              batchSkipped++;
              continue;
            }

            const startMs = Date.now();
            const brief = await generateProposalBrief(input);
            const generationTimeMs = Date.now() - startMs;

            await storeProposalBrief(
              p.txHash,
              p.index,
              brief,
              input.convictionScore,
              input.polarizationScore,
              currentHash,
              input.rationales.length,
              MODELS.FAST,
              generationTimeMs,
            );

            batchGenerated++;
          } catch (err) {
            logger.error('[ProposalBrief] Batch item failed', {
              txHash: p.txHash,
              index: p.index,
              error: err,
            });
            batchSkipped++;
          }
        }

        return { generated: batchGenerated, skipped: batchSkipped };
      });

      generated += result.generated;
      skipped += result.skipped;
    }

    logger.info('[ProposalBrief] Batch complete', {
      processed: proposals.length,
      generated,
      skipped,
    });

    return { processed: proposals.length, generated, skipped };
  },
);
