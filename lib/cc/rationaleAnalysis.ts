/**
 * CC Rationale AI Analysis
 *
 * Constructs prompts and parses AI responses for deep analysis of
 * CC member rationales. Uses Claude to assess interpretation stance,
 * reasoning quality, key arguments, and notable findings.
 *
 * Part of the Constitutional Intelligence pipeline (Chunk 3).
 */

import { generateJSON } from '@/lib/ai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RationaleAnalysisInput {
  ccHotId: string;
  authorName: string | null;
  proposalTitle: string | null;
  proposalType: string;
  vote: string;
  rationaleSummary: string;
  citedArticles: string[];
  expectedArticles: string[];
  priorInterpretations: PriorInterpretation[];
}

export interface PriorInterpretation {
  article: string;
  proposalTitle: string;
  epoch: number;
  stance: string;
  summary: string;
}

export interface RationaleAnalysisResult {
  interpretation_stance: string | null;
  key_arguments: { claim: string; evidence: string; article_cited: string }[];
  logical_structure: string;
  rationality_score: number;
  reciprocity_score: number;
  clarity_score: number;
  deliberation_quality: number;
  articles_analyzed: {
    article: string;
    interpretation: string;
    stance: string;
  }[];
  novel_interpretation: boolean;
  contradicts_own_precedent: boolean;
  notable_finding: string | null;
  finding_severity: 'info' | 'noteworthy' | 'concern' | 'critical' | null;
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

function buildPrompt(input: RationaleAnalysisInput): string {
  const priorBlock =
    input.priorInterpretations.length > 0
      ? input.priorInterpretations
          .map(
            (p) =>
              `- ${p.article} (Epoch ${p.epoch}, "${p.proposalTitle}"): ${p.stance} — ${p.summary}`,
          )
          .join('\n')
      : 'No prior interpretation history for this member.';

  const citedBlock = input.citedArticles.length > 0 ? input.citedArticles.join(', ') : 'None cited';

  const expectedBlock =
    input.expectedArticles.length > 0
      ? input.expectedArticles.join(', ')
      : 'No specific articles expected';

  return `You are a constitutional law analyst for Cardano's governance system.

Analyze this CC member's rationale for their vote on a governance action.

## Context
- CC Member: ${input.authorName ?? 'Unknown'} (${input.ccHotId})
- Proposal: ${input.proposalTitle ?? 'Untitled'} (Type: ${input.proposalType})
- Vote: ${input.vote}
- Expected constitutional articles for this proposal type: ${expectedBlock}

## Prior Interpretation History
This member has previously interpreted these articles as follows:
${priorBlock}

## Rationale Text
${input.rationaleSummary}

## Cited Articles
${citedBlock}

## Instructions
Analyze this rationale and return a JSON object with these fields:

1. **interpretation_stance** (per cited article): 'strict' | 'moderate' | 'broad'
   - strict: narrow, textual reading limiting the article's scope
   - moderate: balanced interpretation following established precedent
   - broad: expansive reading extending the article's application

2. **key_arguments**: Array of {claim, evidence, article_cited} — the 2-4 core arguments

3. **logical_structure**: 'deductive' | 'analogical' | 'precedent-based' | 'textual'

4. **rationality_score** (0-100): Is the reasoning evidence-based and logically sound?
   - 90-100: Rigorous legal reasoning with clear evidence chain
   - 70-89: Solid reasoning with minor gaps
   - 50-69: Reasoning present but weak evidence or logical gaps
   - 0-49: Assertion without substantiation

5. **reciprocity_score** (0-100): Does the rationale engage with other perspectives?
   - 90-100: Directly addresses counterarguments or other CC members' positions
   - 70-89: Acknowledges alternative interpretations
   - 50-69: Single-perspective but thorough
   - 0-49: No engagement with alternatives

6. **clarity_score** (0-100): Is the prose clear, well-structured, and accessible?

7. **deliberation_quality** (0-100): Composite of rationality, reciprocity, and clarity.
   Weight rationality at 50%, reciprocity at 30%, clarity at 20%.

8. **articles_analyzed**: Array of {article, interpretation, stance} for EACH article cited

9. **novel_interpretation** (boolean): Does this represent a new reading of any article
   not seen in this member's prior history?

10. **contradicts_own_precedent** (boolean): Does this interpretation conflict with their
    prior interpretation of the same article? Only true if a clear reversal.

11. **notable_finding** (string): The single most noteworthy thing about this rationale.
    Be specific and concrete. Examples:
    - "First time this member has cited Article IV in a treasury context"
    - "Contradicts their own strict reading of Article II §6 from Epoch 520"
    - "Only CC member to argue this proposal violates Article III §6"
    If nothing notable: null

12. **finding_severity**: 'info' | 'noteworthy' | 'concern' | 'critical'
    If notable_finding is null, set this to null.

Return ONLY valid JSON matching this schema. No commentary.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a CC rationale using AI. Returns null on failure (graceful degradation).
 */
export async function analyzeRationale(
  input: RationaleAnalysisInput,
): Promise<RationaleAnalysisResult | null> {
  try {
    const prompt = buildPrompt(input);
    const result = await generateJSON<RationaleAnalysisResult>(prompt, {
      model: 'FAST',
      maxTokens: 2048,
      temperature: 0.2,
      system:
        'You are a constitutional governance analyst. Return only valid JSON with no markdown formatting or commentary.',
    });

    if (!result) {
      logger.warn('[rationaleAnalysis] AI returned null for rationale analysis', {
        ccHotId: input.ccHotId,
      });
      return null;
    }

    // Validate required numeric fields are in range
    if (
      typeof result.rationality_score !== 'number' ||
      typeof result.reciprocity_score !== 'number' ||
      typeof result.clarity_score !== 'number'
    ) {
      logger.warn('[rationaleAnalysis] AI response missing required score fields', {
        ccHotId: input.ccHotId,
      });
      return null;
    }

    // Clamp scores to 0-100
    result.rationality_score = clamp(result.rationality_score, 0, 100);
    result.reciprocity_score = clamp(result.reciprocity_score, 0, 100);
    result.clarity_score = clamp(result.clarity_score, 0, 100);
    result.deliberation_quality = clamp(
      typeof result.deliberation_quality === 'number'
        ? result.deliberation_quality
        : Math.round(
            result.rationality_score * 0.5 +
              result.reciprocity_score * 0.3 +
              result.clarity_score * 0.2,
          ),
      0,
      100,
    );

    return result;
  } catch (err) {
    logger.error('[rationaleAnalysis] Unexpected error during analysis', {
      error: err instanceof Error ? err.message : String(err),
      ccHotId: input.ccHotId,
    });
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
