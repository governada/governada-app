/**
 * Skill: Amendment Conflict Check
 *
 * Analyzes proposed constitutional amendments against UNCHANGED articles to
 * detect logical conflicts, contradictions, or unintended side effects.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';
import { CONSTITUTION_NODES, CONSTITUTION_VERSION } from '@/lib/constitution/fullText';
import type { AmendmentConflictCheckOutput, AmendmentConflict } from '@/lib/constitution/types';

const inputSchema = z.object({
  amendments: z.array(
    z.object({
      articleId: z.string(),
      originalText: z.string(),
      proposedText: z.string(),
    }),
  ),
});

type Input = z.infer<typeof inputSchema>;

/** Build the full constitution text for context. */
function buildConstitutionReference(): string {
  return CONSTITUTION_NODES.map((n) => `[${n.id}] ${n.title}\n${n.text}`).join('\n\n---\n\n');
}

registerSkill<Input, AmendmentConflictCheckOutput>({
  name: 'amendment-conflict-check',
  description:
    'Analyze proposed constitutional amendments for conflicts with unchanged articles and internal contradictions.',
  category: 'shared',
  inputSchema,
  model: 'FAST',
  maxTokens: 2048,

  systemPrompt: (ctx: SkillContext) => {
    const constitutionRef = buildConstitutionReference();
    return `You are a Cardano constitutional conflict analyst. Your task is to analyze proposed amendments against the UNCHANGED portions of the constitution and identify conflicts, contradictions, or unintended side effects.

${ctx.personalContextStr ? `The reviewer's governance perspective:\n${ctx.personalContextStr}\n\nWeight your analysis toward constitutional concerns most relevant to THIS reviewer.\n` : ''}
Focus on:
1. Direct contradictions — does the proposed text conflict with unchanged articles?
2. Definitional inconsistencies — does the change break defined terms used elsewhere?
3. Procedural gaps — does the change create an unresolvable procedural conflict?
4. Scope overreach — does the change inadvertently affect protections in other articles?

Severity levels:
- "critical": Direct contradiction with another article that cannot coexist
- "warning": Potential tension or ambiguity that should be addressed
- "info": Minor inconsistency or stylistic concern, not blocking

Return ONLY valid JSON with this exact structure:
{
  "conflicts": [
    {
      "amendedArticle": "article-X-sY",
      "conflictingArticle": "article-A-sB",
      "description": "Clear explanation of the conflict",
      "severity": "info|warning|critical"
    }
  ],
  "summary": "One-sentence overall assessment"
}

If no conflicts are found, return: {"conflicts": [], "summary": "No conflicts detected with unchanged constitutional provisions."}

FULL CONSTITUTION TEXT (${CONSTITUTION_VERSION}):

${constitutionRef}`;
  },

  buildPrompt: (input: Input) => {
    const parts = ['Proposed amendments to check for conflicts:', ''];
    for (const amendment of input.amendments) {
      parts.push(
        `Article: ${amendment.articleId}`,
        `Original: "${amendment.originalText}"`,
        `Proposed: "${amendment.proposedText}"`,
        '',
      );
    }
    parts.push(
      'Analyze these proposed changes against ALL unchanged articles of the constitution. Identify any conflicts, contradictions, or unintended side effects. Return valid JSON only.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): AmendmentConflictCheckOutput => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        conflicts: Array.isArray(parsed.conflicts)
          ? parsed.conflicts.map(
              (c: {
                amendedArticle?: string;
                conflictingArticle?: string;
                description?: string;
                severity?: string;
              }) => ({
                amendedArticle: String(c.amendedArticle ?? ''),
                conflictingArticle: String(c.conflictingArticle ?? ''),
                description: String(c.description ?? ''),
                severity: (['info', 'warning', 'critical'].includes(c.severity ?? '')
                  ? c.severity
                  : 'info') as AmendmentConflict['severity'],
              }),
            )
          : [],
        summary: String(parsed.summary ?? ''),
      };
    } catch {
      // Regex fallback for malformed JSON
      const summaryMatch = raw.match(new RegExp(`"summary"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's'));
      const summary = summaryMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') ?? '';

      // Try to extract conflicts array
      const conflictsMatch = raw.match(/"conflicts"\s*:\s*\[([\s\S]*?)\]/);
      const conflicts: AmendmentConflict[] = [];
      if (conflictsMatch) {
        const objRegex = /\{[^{}]*\}/g;
        let m: RegExpExecArray | null;
        while ((m = objRegex.exec(conflictsMatch[1])) !== null) {
          try {
            const obj = JSON.parse(m[0]);
            conflicts.push({
              amendedArticle: String(obj.amendedArticle ?? ''),
              conflictingArticle: String(obj.conflictingArticle ?? ''),
              description: String(obj.description ?? ''),
              severity: (['info', 'warning', 'critical'].includes(obj.severity ?? '')
                ? obj.severity
                : 'info') as AmendmentConflict['severity'],
            });
          } catch {
            // skip malformed conflict object
          }
        }
      }

      return {
        conflicts,
        summary: summary || 'Conflict analysis could not be fully parsed. Please try again.',
      };
    }
  },

  validationPass: {
    systemPrompt: `You are a constitutional conflict validator. Your job is to verify that each detected amendment conflict is actually grounded in the proposed amendment text and the unchanged constitutional articles. Remove conflicts that are speculative, hallucinated, or not supported by the actual text.

Return ONLY valid JSON with this structure:
{
  "validated_conflicts": [{"amendedArticle": "...", "conflictingArticle": "...", "description": "...", "severity": "..."}],
  "rejected_conflicts": [{"amendedArticle": "...", "conflictingArticle": "...", "reason": "why this conflict was rejected"}]
}`,

    buildPrompt: (input: Input, output: AmendmentConflictCheckOutput): string => {
      const parts = [
        'Validate these amendment conflict findings against the actual texts:',
        '',
        'Proposed amendments:',
      ];
      for (const amendment of input.amendments) {
        parts.push(
          `  Article: ${amendment.articleId}`,
          `  Original: "${amendment.originalText.slice(0, 200)}${amendment.originalText.length > 200 ? '...' : ''}"`,
          `  Proposed: "${amendment.proposedText.slice(0, 200)}${amendment.proposedText.length > 200 ? '...' : ''}"`,
          '',
        );
      }
      parts.push('Detected conflicts to validate:');
      for (const conflict of output.conflicts) {
        parts.push(
          `- ${conflict.amendedArticle} vs ${conflict.conflictingArticle}: ${conflict.description} [${conflict.severity}]`,
        );
      }
      parts.push(
        '',
        'For each conflict, verify it is grounded in the actual amendment text and the referenced unchanged article. Reject conflicts that are speculative or not supported by the actual texts.',
      );
      return parts.join('\n');
    },

    parseValidation: (
      raw: string,
      originalOutput: AmendmentConflictCheckOutput,
    ): AmendmentConflictCheckOutput => {
      try {
        const cleaned = raw
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        const validatedConflicts: AmendmentConflict[] = Array.isArray(parsed.validated_conflicts)
          ? parsed.validated_conflicts.map(
              (c: {
                amendedArticle?: string;
                conflictingArticle?: string;
                description?: string;
                severity?: string;
              }) => ({
                amendedArticle: String(c.amendedArticle ?? ''),
                conflictingArticle: String(c.conflictingArticle ?? ''),
                description: String(c.description ?? ''),
                severity: (['info', 'warning', 'critical'].includes(c.severity ?? '')
                  ? c.severity
                  : 'info') as AmendmentConflict['severity'],
              }),
            )
          : originalOutput.conflicts;

        return {
          conflicts: validatedConflicts,
          summary:
            validatedConflicts.length === 0
              ? 'No conflicts detected after validation.'
              : `${validatedConflicts.length} validated conflict(s).`,
        };
      } catch {
        return originalOutput;
      }
    },

    maxTokens: 1024,
  },
});
