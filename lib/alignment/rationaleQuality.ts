/**
 * AI-powered rationale quality scoring.
 * Scores vote rationales on specificity, reasoning depth, and proposal-awareness.
 */

import { generateJSON } from '@/lib/ai';
import { getSupabaseAdmin } from '@/lib/supabase';

interface RationaleInput {
  drepId: string;
  proposalTxHash: string;
  proposalIndex: number;
  rationaleText: string;
  proposalTitle?: string;
}

interface AIQualityResponse {
  score: number;
  specificity: number;
  reasoning_depth: number;
  proposal_awareness: number;
}

const QUALITY_SYSTEM = `You are evaluating the quality of a DRep's vote rationale in Cardano governance.
Score on a 0-100 scale across three sub-dimensions, then provide an overall score.
Return JSON only.`;

function buildQualityPrompt(input: RationaleInput): string {
  return `Score this governance vote rationale (0-100 each dimension):

${input.proposalTitle ? `Proposal: ${input.proposalTitle}` : ''}
Rationale: "${input.rationaleText.slice(0, 1000)}"

Dimensions:
- specificity: Does it reference specific details, numbers, or stakeholders? (vs generic platitudes)
- reasoning_depth: Does it explain WHY, with cause-effect reasoning? (vs just stating a position)
- proposal_awareness: Does it show the voter read and understood the proposal? (vs copy-paste / template)

Return JSON: { "score": 0-100, "specificity": 0-100, "reasoning_depth": 0-100, "proposal_awareness": 0-100 }`;
}

/**
 * Score rationales that haven't been scored yet.
 * Only processes rationales with actual text content.
 */
export async function scoreRationalesBatch(
  rationales: RationaleInput[],
): Promise<Map<string, number>> {
  if (rationales.length === 0) return new Map();

  const supabase = getSupabaseAdmin();
  const results = new Map<string, number>();

  // Check which already have scores
  const { data: existing } = await supabase
    .from('drep_votes')
    .select('drep_id, proposal_tx_hash, proposal_index, rationale_quality')
    .not('rationale_quality', 'is', null)
    .in('drep_id', [...new Set(rationales.map((r) => r.drepId))]);

  const scoredSet = new Set<string>();
  for (const row of existing || []) {
    const key = `${row.drep_id}-${row.proposal_tx_hash}-${row.proposal_index}`;
    scoredSet.add(key);
    results.set(key, row.rationale_quality);
  }

  const unscored = rationales.filter((r) => {
    const key = `${r.drepId}-${r.proposalTxHash}-${r.proposalIndex}`;
    return !scoredSet.has(key);
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
          maxTokens: 128,
        });

        const score = aiResult
          ? Math.max(0, Math.min(100, Math.round(aiResult.score)))
          : heuristicScore(input.rationaleText);

        return { input, score };
      }),
    );

    const updates: {
      drep_id: string;
      proposal_tx_hash: string;
      proposal_index: number;
      rationale_quality: number;
    }[] = [];

    for (const result of scores) {
      if (result.status === 'fulfilled') {
        const { input, score } = result.value;
        const key = `${input.drepId}-${input.proposalTxHash}-${input.proposalIndex}`;
        results.set(key, score);
        updates.push({
          drep_id: input.drepId,
          proposal_tx_hash: input.proposalTxHash,
          proposal_index: input.proposalIndex,
          rationale_quality: score,
        });
      }
    }

    // Batch update scores
    if (updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from('drep_votes')
          .update({ rationale_quality: update.rationale_quality })
          .eq('drep_id', update.drep_id)
          .eq('proposal_tx_hash', update.proposal_tx_hash)
          .eq('proposal_index', update.proposal_index);
      }
    }
  }

  console.log(`[alignment] Scored ${unscored.length} rationales (${results.size} total cached)`);
  return results;
}

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
