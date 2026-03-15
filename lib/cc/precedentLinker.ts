/**
 * CC Precedent Linker
 *
 * Uses AI to classify the relationship between two CC decisions
 * that involve overlapping constitutional articles. This builds
 * the "case law" graph for Cardano governance.
 *
 * Part of the Constitutional Intelligence pipeline (Chunk 3).
 */

import { generateJSON } from '@/lib/ai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrecedentInput {
  sourceTitle: string;
  sourceType: string;
  sourceEpoch: number;
  sourceOutcome: string; // 'Yes' | 'No' | 'Abstain'
  sourceArticles: string[];
  sourceInterpretation: string;
  targetTitle: string;
  targetType: string;
  targetEpoch: number;
  targetOutcome: string;
  targetArticles: string[];
  targetInterpretation: string;
}

export interface PrecedentResult {
  relationship: 'follows' | 'extends' | 'narrows' | 'contradicts' | 'distinguishes';
  shared_articles: string[];
  explanation: string;
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

function buildPrompt(input: PrecedentInput): string {
  return `You are a constitutional precedent analyst for Cardano's governance.

Classify the relationship between two CC decisions that involve the same
constitutional articles.

## Later Decision (Source)
- Proposal: ${input.sourceTitle} (${input.sourceType}, Epoch ${input.sourceEpoch})
- CC Outcome: ${input.sourceOutcome}
- Key articles cited: ${input.sourceArticles.join(', ')}
- Key interpretation: ${input.sourceInterpretation}

## Earlier Decision (Target)
- Proposal: ${input.targetTitle} (${input.targetType}, Epoch ${input.targetEpoch})
- CC Outcome: ${input.targetOutcome}
- Key articles cited: ${input.targetArticles.join(', ')}
- Key interpretation: ${input.targetInterpretation}

## Classify the relationship as ONE of:
- **follows**: Later decision applies the same interpretation as the earlier one
- **extends**: Later decision builds on the earlier interpretation, applying it to a new context
- **narrows**: Later decision limits the scope of the earlier interpretation
- **contradicts**: Later decision directly conflicts with the earlier interpretation
- **distinguishes**: Later decision acknowledges the earlier one but argues it doesn't apply here

Return JSON: {relationship, shared_articles, explanation}
- shared_articles: Array of article identifiers cited in BOTH decisions
- explanation: 1-2 sentences explaining WHY this relationship exists

Return ONLY valid JSON. No commentary.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const VALID_RELATIONSHIPS = new Set([
  'follows',
  'extends',
  'narrows',
  'contradicts',
  'distinguishes',
]);

/**
 * Classify the precedent relationship between two CC decisions.
 * Returns null on AI failure (graceful degradation).
 */
export async function classifyPrecedent(input: PrecedentInput): Promise<PrecedentResult | null> {
  try {
    const prompt = buildPrompt(input);
    const result = await generateJSON<PrecedentResult>(prompt, {
      model: 'FAST',
      maxTokens: 512,
      temperature: 0.1,
      system:
        'You are a constitutional governance analyst. Return only valid JSON with no markdown formatting or commentary.',
    });

    if (!result) {
      logger.warn('[precedentLinker] AI returned null for precedent classification');
      return null;
    }

    // Validate relationship field
    if (!VALID_RELATIONSHIPS.has(result.relationship)) {
      logger.warn('[precedentLinker] Invalid relationship type from AI', {
        relationship: result.relationship,
      });
      return null;
    }

    // Ensure shared_articles is an array
    if (!Array.isArray(result.shared_articles)) {
      result.shared_articles = [];
    }

    // Ensure explanation is a string
    if (typeof result.explanation !== 'string') {
      result.explanation = '';
    }

    return result;
  } catch (err) {
    logger.error('[precedentLinker] Unexpected error during classification', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
