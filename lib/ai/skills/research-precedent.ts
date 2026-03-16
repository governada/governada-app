/**
 * Skill: Research Precedent
 *
 * Finds and analyzes similar past proposals, comparing outcomes and
 * highlighting patterns relevant to the user's governance perspective.
 */

import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { registerSkill } from './registry';
import type { SkillContext } from './types';

const inputSchema = z.object({
  proposalTitle: z.string().min(1),
  proposalAbstract: z.string().optional(),
  proposalType: z.string(),
  withdrawalAmount: z.number().optional(),
});

type Input = z.infer<typeof inputSchema>;

interface SimilarProposal {
  txHash: string;
  title: string;
  proposalType: string;
  withdrawalAmount: number | null;
  status: string;
  comparison: string;
}

interface Output {
  similarProposals: SimilarProposal[];
  precedentSummary: string;
  questionsToConsider: string[];
}

registerSkill<Input, Output>({
  name: 'research-precedent',
  description:
    'Find similar past proposals, compare outcomes, and highlight patterns relevant to your governance perspective.',
  category: 'shared',
  inputSchema,
  model: 'FAST',
  maxTokens: 2048,

  systemPrompt: (
    ctx: SkillContext,
  ) => `You are a governance research assistant for the Cardano blockchain.
Your job is to analyze historical governance proposals and find relevant precedents.

IMPORTANT: You are analyzing from this specific person's perspective:
${ctx.personalContextStr}

Do NOT provide generic analysis. Frame your findings in terms of what matters to THIS person
based on their governance philosophy, voting history, and alignment.

Produce a JSON response with this structure:
{
  "similarProposals": [{ "txHash": "...", "title": "...", "proposalType": "...", "withdrawalAmount": null, "status": "...", "comparison": "..." }],
  "precedentSummary": "A 2-3 sentence summary of what precedent tells us",
  "questionsToConsider": ["Question 1 for the reviewer to think about", "Question 2", ...]
}

The questionsToConsider should be personalized — questions this specific person should ask
given their governance priorities. Not generic questions.`,

  buildPrompt: (input: Input, _ctx: SkillContext) => {
    // Fetch similar proposals from DB will happen in the API route
    // For now, build the prompt with what we have
    const parts = [`Proposal to analyze: "${input.proposalTitle}"`, `Type: ${input.proposalType}`];

    if (input.proposalAbstract) parts.push(`Abstract: ${input.proposalAbstract}`);
    if (input.withdrawalAmount) parts.push(`Requested amount: ${input.withdrawalAmount} ADA`);

    parts.push(
      '\nFind similar past governance proposals and analyze:',
      '1. What similar proposals have been submitted before?',
      '2. What were their outcomes (ratified, expired, dropped)?',
      '3. What patterns emerge from how the community voted on similar proposals?',
      '4. What should the reviewer consider based on precedent?',
    );

    return parts.join('\n');
  },

  parseOutput: (raw: string): Output => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      return JSON.parse(cleaned) as Output;
    } catch {
      return {
        similarProposals: [],
        precedentSummary: raw.slice(0, 500),
        questionsToConsider: [],
      };
    }
  },
});

/**
 * Fetch similar proposals from the database for context injection.
 * Called by the skill API route before generating the prompt.
 */
export async function fetchSimilarProposals(
  proposalType: string,
  _title: string,
  limit = 5,
): Promise<
  Array<{
    tx_hash: string;
    title: string;
    proposal_type: string;
    withdrawal_amount: number | null;
    ratified_epoch: number | null;
    expired_epoch: number | null;
    dropped_epoch: number | null;
  }>
> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('proposals')
    .select(
      'tx_hash, title, proposal_type, withdrawal_amount, ratified_epoch, expired_epoch, dropped_epoch',
    )
    .eq('proposal_type', proposalType)
    .not('title', 'is', null)
    .order('block_time', { ascending: false })
    .limit(limit);

  return data ?? [];
}
