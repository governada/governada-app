/**
 * AI-powered proposal body quality scoring.
 *
 * Scores governance proposal bodies on 4 dimensions:
 *   - deliverable_specificity: Are deliverables concrete and measurable?
 *   - budget_justification: Is the budget clearly broken down and reasonable?
 *   - success_criteria: Are success metrics defined?
 *   - constitutional_alignment: Does the proposal reference relevant governance principles?
 *
 * Feeds the Proposer Score's Proposal Quality pillar.
 * Only scores proposals with body text (from meta_json.body or abstract).
 */

import { generateJSON } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalInput {
  txHash: string;
  proposalIndex: number;
  title: string;
  proposalType: string;
  abstract?: string;
  bodyText?: string;
  withdrawalAmount?: number;
}

interface AIProposalQualityResponse {
  overall_score: number;
  deliverable_specificity: number;
  budget_justification: number;
  success_criteria: number;
  constitutional_alignment: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const PROPOSAL_QUALITY_SYSTEM = `You are evaluating the quality of a Cardano governance proposal.

Score the proposal on 4 dimensions (0-100 each) and provide an overall quality score.

Scoring criteria:
- 80-100: Excellent — specific deliverables with timelines, detailed budget breakdown, measurable success criteria, constitutional grounding
- 60-79: Good — clear scope but some vagueness in deliverables or budget, basic success criteria
- 40-59: Adequate — states what will be done but lacks specificity, budget is a single number, no success metrics
- 20-39: Weak — vague scope, no budget justification, unclear what success looks like
- 0-19: Minimal — placeholder text, no meaningful proposal content

For non-treasury proposals (InfoAction, ParameterChange, etc.), score budget_justification as 50 (neutral).

Return JSON only.`;

function buildProposalQualityPrompt(input: ProposalInput): string {
  const bodyPreview = input.bodyText?.slice(0, 3000) ?? input.abstract?.slice(0, 1500) ?? '';
  const amountContext =
    input.withdrawalAmount && input.proposalType === 'TreasuryWithdrawals'
      ? `\nRequested amount: ${(input.withdrawalAmount / 1_000_000).toLocaleString()} ADA`
      : '';

  return `Score this governance proposal (0-100 each dimension):

Title: "${input.title}"
Type: ${input.proposalType}${amountContext}

Proposal content:
"${bodyPreview}"

Dimensions:
- deliverable_specificity: Are deliverables concrete, measurable, and time-bound? (vs vague promises)
- budget_justification: Is the budget broken down into line items with rationale? (neutral for non-treasury)
- success_criteria: Are measurable success metrics or KPIs defined? (vs "we will improve X")
- constitutional_alignment: Does it reference relevant governance principles or constitutional provisions?

Also write a 1-sentence quality assessment for display to DReps reviewing this proposal.

Return JSON: { "overall_score": 0-100, "deliverable_specificity": 0-100, "budget_justification": 0-100, "success_criteria": 0-100, "constitutional_alignment": 0-100, "summary": "..." }`;
}

// ---------------------------------------------------------------------------
// Batch scoring
// ---------------------------------------------------------------------------

/**
 * Score proposal bodies that haven't been scored yet.
 * Results are stored in the proposals table.
 */
export async function scoreProposalBodiesBatch(limit = 50): Promise<{ scored: number }> {
  const supabase = getSupabaseAdmin();

  // Find proposals with body content that haven't been quality-scored
  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type, abstract, withdrawal_amount, meta_json')
    .is('ai_proposal_quality', null)
    .not('abstract', 'is', null)
    .order('proposed_epoch', { ascending: false })
    .limit(limit);

  if (!proposals?.length) return { scored: 0 };

  let scored = 0;

  // Process in batches of 5 (proposal bodies are larger than rationales)
  const BATCH_SIZE = 5;
  for (let i = 0; i < proposals.length; i += BATCH_SIZE) {
    const batch = proposals.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const meta = p.meta_json as Record<string, unknown> | null;
        const bodyObj = meta?.body as Record<string, unknown> | null;
        let bodyText = '';
        if (bodyObj && typeof bodyObj === 'object') {
          // CIP-108 body can be structured — extract text content
          bodyText = JSON.stringify(bodyObj).slice(0, 3000);
        }

        const input: ProposalInput = {
          txHash: p.tx_hash,
          proposalIndex: p.proposal_index,
          title: p.title ?? 'Untitled Proposal',
          proposalType: p.proposal_type,
          abstract: p.abstract as string | undefined,
          bodyText: bodyText || undefined,
          withdrawalAmount: p.withdrawal_amount ? Number(p.withdrawal_amount) : undefined,
        };

        const aiResult = await generateJSON<AIProposalQualityResponse>(
          buildProposalQualityPrompt(input),
          { system: PROPOSAL_QUALITY_SYSTEM, maxTokens: 256 },
        );

        return { input, aiResult };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.aiResult) {
        const { input, aiResult } = result.value;
        const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

        await supabase
          .from('proposals')
          .update({
            ai_proposal_quality: clamp(aiResult.overall_score),
            ai_proposal_quality_details: {
              deliverableSpecificity: clamp(aiResult.deliverable_specificity),
              budgetJustification: clamp(aiResult.budget_justification),
              successCriteria: clamp(aiResult.success_criteria),
              constitutionalAlignment: clamp(aiResult.constitutional_alignment),
              summary: aiResult.summary?.slice(0, 500) ?? null,
            },
          })
          .eq('tx_hash', input.txHash)
          .eq('proposal_index', input.proposalIndex);

        scored++;
      }
    }
  }

  logger.info('[proposalQuality] Scored proposal bodies', { scored, total: proposals.length });
  return { scored };
}
