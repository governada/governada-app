/**
 * AI-powered rationale quality scoring + summary generation.
 *
 * V3: Dual-rubric ensemble scoring with multi-model redundancy.
 *
 * Primary rubric (Claude Sonnet 4.6) — analytical quality:
 *   - specificity: References specific details, numbers, stakeholders
 *   - reasoning_depth: Explains WHY with cause-effect reasoning
 *   - proposal_awareness: Shows voter read and understood the proposal
 *   - constitutional_grounding: References governance principles or constitutional provisions
 *
 * Secondary rubric (GPT-4o) — governance discourse value:
 *   - governance_value: Advances governance discourse, helps citizens understand
 *   - trade_off_engagement: Acknowledges trade-offs or competing interests
 *   - constructiveness: Offers reasoning that informs future decisions
 *
 * Final score = weighted average (55% primary, 45% secondary) when both available.
 * Divergence > 15 points flagged for audit trail.
 */

import { generateJSON, generateTextWithModel, MODELS } from '@/lib/ai';
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

interface PrimaryAIResponse {
  score: number;
  specificity: number;
  reasoning_depth: number;
  proposal_awareness: number;
  constitutional_grounding: number;
  summary: string;
}

interface SecondaryAIResponse {
  score: number;
  governance_value: number;
  trade_off_engagement: number;
  constructiveness: number;
}

/** Divergence threshold — scores differing by more than this are flagged */
const DIVERGENCE_THRESHOLD = 15;

/** Weight split: primary 55%, secondary 45% */
const PRIMARY_WEIGHT = 0.55;
const SECONDARY_WEIGHT = 0.45;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const PRIMARY_SYSTEM = `You are evaluating the quality of a DRep's vote rationale in Cardano governance.

Score on a 0-100 scale across four sub-dimensions, provide an overall quality score, and write a citizen-facing summary.

Scoring criteria:
- 90-100: Exceptional — specific data points, clear cause-effect chains, constitutional references, original analysis
- 70-89: Strong — addresses the proposal specifically, explains reasoning, shows understanding
- 40-69: Moderate — states a position with some justification but lacks depth or specificity
- 15-39: Weak — generic statement, minimal reasoning, could apply to any proposal
- 0-14: Minimal — "Yes", "I agree", or copy of the proposal text

IMPORTANT: Score reasoning quality only — never the vote direction. A well-reasoned "No" scores the same as a well-reasoned "Yes".

Return JSON only.`;

function buildPrimaryPrompt(input: RationaleInput): string {
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

const SECONDARY_SYSTEM = `You are evaluating a governance vote rationale for its contribution to governance discourse in Cardano.

Score on a 0-100 scale across three dimensions plus an overall score.

Scoring criteria:
- 90-100: Exceptional — genuinely advances governance understanding, engages with trade-offs, informs future decisions
- 70-89: Strong — helps citizens understand the decision, acknowledges complexity
- 40-69: Moderate — states reasoning but doesn't engage with broader governance context
- 15-39: Weak — pure position-taking with minimal governance value
- 0-14: Minimal — no meaningful contribution to discourse

IMPORTANT: Score governance contribution only — never the vote direction.

Return JSON only.`;

function buildSecondaryPrompt(input: RationaleInput): string {
  const voteContext = input.vote ? `\nVote: ${input.vote}` : '';
  return `Evaluate this governance vote rationale for its contribution to governance discourse (0-100 each):

${input.proposalTitle ? `Proposal: "${input.proposalTitle}"` : ''}${voteContext}
Rationale: "${input.rationaleText.slice(0, 2000)}"

Dimensions:
- governance_value: Does this rationale advance governance discourse? Would it help a citizen understand the decision?
- trade_off_engagement: Does it acknowledge trade-offs or competing interests? (vs one-sided advocacy)
- constructiveness: Does it offer reasoning that could inform future governance decisions? (vs pure position-taking)

Return JSON: { "score": 0-100, "governance_value": 0-100, "trade_off_engagement": 0-100, "constructiveness": 0-100 }`;
}

// ---------------------------------------------------------------------------
// Secondary model call (GPT-4o)
// ---------------------------------------------------------------------------

async function scoreWithSecondary(input: RationaleInput): Promise<SecondaryAIResponse | null> {
  try {
    const { text } = await generateTextWithModel(buildSecondaryPrompt(input), MODELS.GPT4O, {
      system: SECONDARY_SYSTEM,
      maxTokens: 128,
      temperature: 0.2,
    });

    if (!text) return null;

    const cleaned = text
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned) as SecondaryAIResponse;
  } catch (err) {
    logger.error('[rationaleQuality] Secondary model (GPT-4o) failed', { error: err });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Input/output validation helpers
// ---------------------------------------------------------------------------

function validateRationaleInput(input: RationaleInput): boolean {
  if (!input.rationaleText || input.rationaleText.trim().length < 3) return false;
  if (!input.drepId || !input.proposalTxHash) return false;
  return true;
}

function validateScoreOutput<T extends object>(
  result: T | null,
  requiredFields: (keyof T)[],
): T | null {
  if (!result) return null;
  for (const field of requiredFields) {
    const val = result[field];
    if (typeof val !== 'number' || val < 0 || val > 100) return null;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Ensemble scoring for a single rationale
// ---------------------------------------------------------------------------

interface EnsembleResult {
  finalScore: number;
  primaryResult: PrimaryAIResponse | null;
  secondaryResult: SecondaryAIResponse | null;
  divergence: number | null;
  divergenceFlag: boolean;
}

async function scoreRationaleEnsemble(input: RationaleInput): Promise<EnsembleResult> {
  // Run both models in parallel
  const [primaryRaw, secondaryRaw] = await Promise.all([
    generateJSON<PrimaryAIResponse>(buildPrimaryPrompt(input), {
      system: PRIMARY_SYSTEM,
      maxTokens: 256,
      temperature: 0.2,
    }),
    scoreWithSecondary(input),
  ]);

  const primary = validateScoreOutput(primaryRaw, [
    'score',
    'specificity',
    'reasoning_depth',
    'proposal_awareness',
  ]);
  const secondary = validateScoreOutput(secondaryRaw, [
    'score',
    'governance_value',
    'trade_off_engagement',
    'constructiveness',
  ]);

  // Compute final score with weighted average or fallback
  let finalScore: number;
  let divergence: number | null = null;
  let divergenceFlag = false;

  if (primary && secondary) {
    const pScore = clamp(primary.score);
    const sScore = clamp(secondary.score);
    finalScore = Math.round(pScore * PRIMARY_WEIGHT + sScore * SECONDARY_WEIGHT);
    divergence = Math.abs(pScore - sScore);
    divergenceFlag = divergence > DIVERGENCE_THRESHOLD;

    if (divergenceFlag) {
      logger.warn('[rationaleQuality] Ensemble divergence detected', {
        drepId: input.drepId,
        proposalTxHash: input.proposalTxHash,
        proposalIndex: input.proposalIndex,
        primaryScore: pScore,
        secondaryScore: sScore,
        divergence,
        rationalePreview: input.rationaleText.slice(0, 200),
      });
    }
  } else if (primary) {
    finalScore = clamp(primary.score);
  } else if (secondary) {
    finalScore = clamp(secondary.score);
  } else {
    finalScore = heuristicScore(input.rationaleText);
  }

  return {
    finalScore,
    primaryResult: primary,
    secondaryResult: secondary,
    divergence,
    divergenceFlag,
  };
}

// ---------------------------------------------------------------------------
// Batch scoring
// ---------------------------------------------------------------------------

/**
 * Score rationales that haven't been scored yet, or re-score those missing
 * sub-dimensions. Generates citizen-facing summaries alongside scores.
 *
 * V3: Uses dual-rubric ensemble (Claude + GPT-4o) with divergence detection.
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

  // Score in batches of 10 (each item makes 2 parallel API calls via ensemble)
  const BATCH_SIZE = 10;
  for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
    const batch = unscored.slice(i, i + BATCH_SIZE);

    const scores = await Promise.allSettled(
      batch.map(async (input) => {
        if (!validateRationaleInput(input)) {
          return { input, ensemble: null as EnsembleResult | null };
        }
        const ensemble = await scoreRationaleEnsemble(input);
        return { input, ensemble };
      }),
    );

    for (const result of scores) {
      if (result.status === 'fulfilled') {
        const { input, ensemble } = result.value;
        const key = `${input.drepId}-${input.proposalTxHash}-${input.proposalIndex}`;

        if (!ensemble) {
          const fallback = heuristicScore(input.rationaleText);
          results.set(key, fallback);
          await supabase
            .from('drep_votes')
            .update({ rationale_quality: fallback })
            .eq('drep_id', input.drepId)
            .eq('proposal_tx_hash', input.proposalTxHash)
            .eq('proposal_index', input.proposalIndex);
          continue;
        }

        results.set(key, ensemble.finalScore);
        const { primaryResult, secondaryResult } = ensemble;

        await supabase
          .from('drep_votes')
          .update({
            rationale_quality: ensemble.finalScore,
            rationale_specificity: primaryResult ? clamp(primaryResult.specificity) : null,
            rationale_reasoning_depth: primaryResult ? clamp(primaryResult.reasoning_depth) : null,
            rationale_proposal_awareness: primaryResult
              ? clamp(primaryResult.proposal_awareness)
              : null,
            rationale_ai_summary: primaryResult?.summary?.slice(0, 500) ?? null,
            rationale_quality_secondary: secondaryResult ? clamp(secondaryResult.score) : null,
            rationale_quality_divergence:
              ensemble.divergence != null ? Math.round(ensemble.divergence) : null,
            rationale_quality_divergence_flag: ensemble.divergenceFlag,
          })
          .eq('drep_id', input.drepId)
          .eq('proposal_tx_hash', input.proposalTxHash)
          .eq('proposal_index', input.proposalIndex);
      }
    }
  }

  logger.info('[rationaleQuality] Scored rationales (ensemble v3)', {
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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
