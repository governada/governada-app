/**
 * AI-powered rationale quality scoring + summary generation.
 *
 * V2: Enhanced prompt with constitutional grounding dimension, citizen-facing
 * summaries, and improved batch processing for full coverage.
 *
 * Scores vote rationales on 4 sub-dimensions:
 *   - specificity: References specific details, numbers, stakeholders
 *   - reasoning_depth: Explains WHY with cause-effect reasoning
 *   - proposal_awareness: Shows voter read and understood the proposal
 *   - constitutional_grounding: References governance principles or constitutional provisions
 *
 * Also generates a 1-2 sentence citizen-facing summary of the rationale's
 * key argument for display on proposal pages.
 */

import { generateJSON } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RationaleInput {
  drepId: string;
  drepName?: string;
  proposalTxHash: string;
  proposalIndex: number;
  rationaleText: string;
  proposalTitle?: string;
  vote?: string;
}

interface AIQualityResponse {
  score: number;
  specificity: number;
  reasoning_depth: number;
  proposal_awareness: number;
  constitutional_grounding: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const QUALITY_SYSTEM = `You are evaluating the quality of a DRep's vote rationale in Cardano governance.

Score on a 0-100 scale across four sub-dimensions, provide an overall quality score, and write a citizen-facing summary.

Scoring criteria:
- 90-100: Exceptional — specific data points, clear cause-effect chains, constitutional references, original analysis
- 70-89: Strong — addresses the proposal specifically, explains reasoning, shows understanding
- 40-69: Moderate — states a position with some justification but lacks depth or specificity
- 15-39: Weak — generic statement, minimal reasoning, could apply to any proposal
- 0-14: Minimal — "Yes", "I agree", or copy of the proposal text

IMPORTANT: Score reasoning quality only — never the vote direction. A well-reasoned "No" scores the same as a well-reasoned "Yes".

Return JSON only.`;

function buildQualityPrompt(input: RationaleInput): string {
  const voteContext = input.vote ? `\nVote: ${input.vote}` : '';
  return `Score this governance vote rationale (0-100 each dimension):

${input.proposalTitle ? `Proposal: "${input.proposalTitle}"` : ''}${voteContext}
DRep rationale: "${input.rationaleText.slice(0, 2000)}"

Dimensions:
- specificity: Does it reference specific details, numbers, amounts, or stakeholders? (vs generic platitudes)
- reasoning_depth: Does it explain WHY with cause-effect reasoning? (vs just stating a position)
- proposal_awareness: Does it show the voter read and understood THIS specific proposal? (vs template rationale)
- constitutional_grounding: Does it reference governance principles, constitutional provisions, or policy rationale? (0 if none)

Also write a citizen-facing summary (1-2 sentences, plain English) of the DRep's key argument. This will be shown to citizens evaluating the proposal.

Return JSON: { "score": 0-100, "specificity": 0-100, "reasoning_depth": 0-100, "proposal_awareness": 0-100, "constitutional_grounding": 0-100, "summary": "..." }`;
}

// ---------------------------------------------------------------------------
// Batch scoring
// ---------------------------------------------------------------------------

/**
 * Score rationales that haven't been scored yet, or re-score those missing
 * sub-dimensions. Generates citizen-facing summaries alongside scores.
 *
 * @param rationales - Rationales to score
 * @param forceRescore - If true, re-score even if already scored (for backfill)
 */
export async function scoreRationalesBatch(
  rationales: RationaleInput[],
  forceRescore = false,
): Promise<Map<string, number>> {
  if (rationales.length === 0) return new Map();

  const supabase = getSupabaseAdmin();
  const results = new Map<string, number>();

  // Find already-scored rationales
  const { data: existing } = await supabase
    .from('drep_votes')
    .select('drep_id, proposal_tx_hash, proposal_index, rationale_quality, rationale_specificity')
    .not('rationale_quality', 'is', null)
    .in('drep_id', [...new Set(rationales.map((r) => r.drepId))])
    .range(0, 99999);

  const scoredSet = new Set<string>();
  const missingSubDimensions = new Set<string>();

  for (const row of existing || []) {
    const key = `${row.drep_id}-${row.proposal_tx_hash}-${row.proposal_index}`;
    scoredSet.add(key);
    results.set(key, row.rationale_quality);

    // Track rationales that have a score but no sub-dimensions (backfill needed)
    if (row.rationale_specificity === null) {
      missingSubDimensions.add(key);
    }
  }

  // Filter to unscored or those needing sub-dimension backfill
  const unscored = rationales.filter((r) => {
    const key = `${r.drepId}-${r.proposalTxHash}-${r.proposalIndex}`;
    if (forceRescore) return true;
    if (!scoredSet.has(key)) return true;
    if (missingSubDimensions.has(key)) return true;
    return false;
  });

  if (unscored.length === 0) return results;

  // Score in batches of 10 to avoid rate limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
    const batch = unscored.slice(i, i + BATCH_SIZE);

    const scores = await Promise.allSettled(
      batch.map(async (input) => {
        const aiResult = await generateJSON<AIQualityResponse>(buildQualityPrompt(input), {
          system: QUALITY_SYSTEM,
          maxTokens: 256,
        });

        const score = aiResult
          ? Math.max(0, Math.min(100, Math.round(aiResult.score)))
          : heuristicScore(input.rationaleText);

        return { input, score, aiResult };
      }),
    );

    for (const result of scores) {
      if (result.status === 'fulfilled') {
        const { input, score, aiResult } = result.value;
        const key = `${input.drepId}-${input.proposalTxHash}-${input.proposalIndex}`;
        results.set(key, score);

        const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

        await supabase
          .from('drep_votes')
          .update({
            rationale_quality: score,
            rationale_specificity: aiResult ? clamp(aiResult.specificity) : null,
            rationale_reasoning_depth: aiResult ? clamp(aiResult.reasoning_depth) : null,
            rationale_proposal_awareness: aiResult ? clamp(aiResult.proposal_awareness) : null,
            rationale_ai_summary: aiResult?.summary?.slice(0, 500) ?? null,
          })
          .eq('drep_id', input.drepId)
          .eq('proposal_tx_hash', input.proposalTxHash)
          .eq('proposal_index', input.proposalIndex);
      }
    }
  }

  logger.info('[rationaleQuality] Scored rationales', {
    scored: unscored.length,
    totalCached: results.size,
    backfilled: missingSubDimensions.size,
  });
  return results;
}

// ---------------------------------------------------------------------------
// Heuristic fallback
// ---------------------------------------------------------------------------

/**
 * Heuristic fallback when AI is unavailable.
 * Rough quality estimate based on text properties.
 */
function heuristicScore(text: string): number {
  if (!text || text.length < 10) return 5;

  let score = 20;

  // Length bonus (longer = more detailed, diminishing returns)
  score += Math.min(25, text.length / 40);

  // Sentence count (more sentences = more reasoning)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  score += Math.min(15, sentences.length * 3);

  // Contains numbers (specificity indicator)
  if (/\d/.test(text)) score += 10;

  // Contains reasoning words
  const reasoningWords = /because|therefore|however|although|since|given|considering|whereas/i;
  if (reasoningWords.test(text)) score += 15;

  // Contains governance-specific terms
  const govTerms = /treasury|parameter|stake|delegat|governance|protocol|epoch|ada|lovelace/i;
  if (govTerms.test(text)) score += 10;

  return Math.min(100, Math.round(score));
}
