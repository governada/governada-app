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
});
