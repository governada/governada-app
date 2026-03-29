/**
 * Shared constitutional analysis logic.
 *
 * Extracted from the constitutional-check skill so that both the interactive
 * skill (via API route) and the background pre-computation pipeline (Inngest)
 * can call the same analysis without going through the skill registry.
 */

import { MODELS, generateTextWithModel } from '@/lib/ai';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConstitutionalFlag {
  article: string;
  section?: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ConstitutionalCheckOutput {
  flags: ConstitutionalFlag[];
  score: 'pass' | 'warning' | 'fail';
  summary: string;
}

export interface ConstitutionalCheckInput {
  title: string;
  abstract?: string;
  proposalType: string;
  motivation?: string;
  rationale?: string;
  typeSpecific?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Core analysis function
// ---------------------------------------------------------------------------

/**
 * Run a constitutional compliance check against a proposal.
 *
 * This is a two-pass analysis:
 *  1. Primary pass: identify potential constitutional concerns
 *  2. Validation pass: verify each flag is grounded in the proposal text
 */
export async function runConstitutionalCheck(
  input: ConstitutionalCheckInput,
): Promise<ConstitutionalCheckOutput> {
  const systemPrompt = `You are a Cardano constitutional compliance analyst. Analyze governance proposals against the Cardano Constitution.

Return ONLY valid JSON with this structure:
{
  "flags": [{"article": "Article X", "section": "Section Y", "concern": "explanation", "severity": "info|warning|critical"}],
  "score": "pass|warning|fail",
  "summary": "One-sentence overall assessment"
}

If no constitutional concerns, return: {"flags": [], "score": "pass", "summary": "No constitutional conflicts detected."}`;

  const promptParts = [`Proposal to analyze: "${input.title}"`, `Type: ${input.proposalType}`];
  if (input.abstract) promptParts.push(`Abstract: ${input.abstract}`);
  if (input.motivation) promptParts.push(`Motivation: ${input.motivation}`);
  if (input.rationale) promptParts.push(`Rationale: ${input.rationale}`);
  if (input.typeSpecific && Object.keys(input.typeSpecific).length > 0) {
    promptParts.push(`Type-specific context: ${JSON.stringify(input.typeSpecific)}`);
  }
  promptParts.push(
    '\nAnalyze this proposal for constitutional compliance. Check against all articles of the Cardano Constitution.',
  );

  try {
    // Primary pass
    const { text: primaryText } = await generateTextWithModel(promptParts.join('\n'), MODELS.FAST, {
      system: systemPrompt,
      maxTokens: 2048,
    });
    if (!primaryText) {
      return { flags: [], score: 'pass', summary: 'Analysis could not be completed.' };
    }

    const primaryOutput = parseConstitutionalOutput(primaryText);

    // Skip validation if no flags
    if (primaryOutput.flags.length === 0) return primaryOutput;

    // Validation pass
    const validationSystem = `You are a constitutional compliance validator. Your job is to verify that each flagged constitutional concern is actually grounded in the proposal text and the Cardano Constitution. Remove any flags that are speculative, hallucinated, or not supported by the actual proposal content.

Return ONLY valid JSON with this structure:
{
  "validated_flags": [{"article": "...", "section": "...", "concern": "...", "severity": "..."}],
  "rejected_flags": [{"article": "...", "reason": "why this flag was rejected"}]
}`;

    const validationParts = [
      'Validate these constitutional flags against the actual proposal:',
      '',
      `Proposal: "${input.title}"`,
      `Type: ${input.proposalType}`,
    ];
    if (input.abstract) validationParts.push(`Abstract: ${input.abstract}`);
    if (input.motivation) validationParts.push(`Motivation: ${input.motivation}`);
    if (input.rationale) validationParts.push(`Rationale: ${input.rationale}`);
    validationParts.push('', 'Flags to validate:');
    for (const flag of primaryOutput.flags) {
      validationParts.push(
        `- ${flag.article}${flag.section ? ` ${flag.section}` : ''}: ${flag.concern} [${flag.severity}]`,
      );
    }
    validationParts.push(
      '',
      'For each flag, verify it is grounded in the actual proposal text. Reject flags that are speculative or not supported by what the proposal actually says.',
    );

    const { text: validationText } = await generateTextWithModel(
      validationParts.join('\n'),
      MODELS.HAIKU,
      { system: validationSystem, maxTokens: 1024 },
    );

    return parseValidationOutput(validationText ?? '', primaryOutput);
  } catch (err) {
    logger.error('[constitutionalAnalysis] Analysis failed', { error: err });
    return {
      flags: [],
      score: 'pass',
      summary: 'Analysis could not be completed.',
    };
  }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseConstitutionalOutput(raw: string): ConstitutionalCheckOutput {
  try {
    const cleaned = raw
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const hasWarning = parsed.some(
        (f: ConstitutionalFlag) => f.severity === 'warning' || f.severity === 'critical',
      );
      const hasCritical = parsed.some((f: ConstitutionalFlag) => f.severity === 'critical');
      return {
        flags: parsed,
        score: hasCritical ? 'fail' : hasWarning ? 'warning' : 'pass',
        summary:
          parsed.length === 0
            ? 'No constitutional conflicts detected.'
            : `${parsed.length} concern(s) found.`,
      };
    }
    return parsed as ConstitutionalCheckOutput;
  } catch {
    return {
      flags: [],
      score: 'pass',
      summary: 'Analysis could not be parsed.',
    };
  }
}

function parseValidationOutput(
  raw: string,
  originalOutput: ConstitutionalCheckOutput,
): ConstitutionalCheckOutput {
  try {
    const cleaned = raw
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const validatedFlags: ConstitutionalFlag[] = Array.isArray(parsed.validated_flags)
      ? parsed.validated_flags
      : originalOutput.flags;

    const hasCritical = validatedFlags.some((f) => f.severity === 'critical');
    const hasWarning = validatedFlags.some(
      (f) => f.severity === 'warning' || f.severity === 'critical',
    );

    return {
      flags: validatedFlags,
      score: hasCritical ? 'fail' : hasWarning ? 'warning' : 'pass',
      summary:
        validatedFlags.length === 0
          ? 'No constitutional conflicts detected after validation.'
          : `${validatedFlags.length} validated concern(s).`,
    };
  } catch {
    return originalOutput;
  }
}
