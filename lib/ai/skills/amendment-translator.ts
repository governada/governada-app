/**
 * Skill: Amendment Translator
 *
 * Translates a natural-language amendment intent into tracked changes against
 * the Cardano Constitution. Each change references an exact substring from
 * the constitution text so it can be applied as a tracked diff.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';
import { CONSTITUTION_NODES, CONSTITUTION_VERSION } from '@/lib/constitution/fullText';
import type { AmendmentTranslatorOutput } from '@/lib/constitution/types';

const inputSchema = z.object({
  intent: z.string().min(10).max(5000),
  targetArticles: z.array(z.string()).optional(),
});

type Input = z.infer<typeof inputSchema>;

/** Build a formatted reference copy of the constitution for the system prompt. */
function buildConstitutionReference(targetArticles?: string[]): string {
  const nodes =
    targetArticles && targetArticles.length > 0
      ? CONSTITUTION_NODES.filter((n) => targetArticles.includes(n.id))
      : CONSTITUTION_NODES;

  return nodes
    .map((n) => {
      const label = n.articleNumber != null ? `[${n.id}] ${n.title}` : `[${n.id}] ${n.title}`;
      return `${label}\n${n.text}`;
    })
    .join('\n\n---\n\n');
}

registerSkill<Input, AmendmentTranslatorOutput>({
  name: 'amendment-translator',
  description:
    'Translate a natural-language amendment intent into tracked changes against the Cardano Constitution.',
  category: 'authoring',
  inputSchema,
  model: 'DRAFT',
  maxTokens: 4096,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) => {
    const constitutionRef = buildConstitutionReference();
    return `You are a Cardano constitutional amendment drafter. Your job is to translate a user's amendment intent into precise, tracked changes against the current Cardano Constitution (${CONSTITUTION_VERSION}).

${ctx.personalContextStr ? `The author's governance perspective:\n${ctx.personalContextStr}\n\nTailor the amendment framing and emphasis to reflect THIS author's governance values and priorities.\n` : ''}
CRITICAL RULES:
1. Every "originalText" you produce MUST be an EXACT substring copied verbatim from the constitution text below. Do NOT paraphrase, truncate, or alter the original text in any way. If you cannot find an exact substring to replace, do NOT invent one.
2. Keep changes minimal and targeted — change only the text necessary to implement the intent.
3. Each change must have a clear, specific explanation of why it is needed.
4. The "articleId" must match one of the node IDs listed in brackets below (e.g. "article-1-s1", "preamble", "article-2-s3").

Return ONLY valid JSON with this exact structure:
{
  "amendments": [
    {
      "articleId": "article-X-sY",
      "originalText": "exact substring from the constitution",
      "proposedText": "replacement text",
      "explanation": "why this change is needed"
    }
  ],
  "summary": "One-paragraph summary of all proposed changes",
  "motivation": "Why this amendment is needed — the problem it addresses and who benefits",
  "rationale": "Why this specific approach is correct — evidence, trade-offs, and why the community should support it"
}

FULL CONSTITUTION TEXT (${CONSTITUTION_VERSION}):

${constitutionRef}`;
  },

  buildPrompt: (input: Input) => {
    const parts = ['Amendment intent:', input.intent];
    if (input.targetArticles && input.targetArticles.length > 0) {
      parts.push('', `Target articles: ${input.targetArticles.join(', ')}`);
    }
    parts.push(
      '',
      'Translate this intent into precise constitutional amendments. Each originalText MUST be an exact verbatim substring from the constitution. Return valid JSON only.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): AmendmentTranslatorOutput => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        amendments: Array.isArray(parsed.amendments)
          ? parsed.amendments.map(
              (a: {
                articleId?: string;
                originalText?: string;
                proposedText?: string;
                explanation?: string;
              }) => ({
                id: crypto.randomUUID(),
                articleId: String(a.articleId ?? ''),
                originalText: String(a.originalText ?? ''),
                proposedText: String(a.proposedText ?? ''),
                explanation: String(a.explanation ?? ''),
                status: 'pending' as const,
              }),
            )
          : [],
        summary: String(parsed.summary ?? ''),
        motivation: String(parsed.motivation ?? ''),
        rationale: String(parsed.rationale ?? ''),
      };
    } catch {
      // Regex fallback for malformed JSON
      const extractField = (name: string): string => {
        const regex = new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
        const match = raw.match(regex);
        return match?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') ?? '';
      };

      // Try to extract amendments array
      const amendmentsMatch = raw.match(/"amendments"\s*:\s*\[([\s\S]*?)\]/);
      const amendments: AmendmentTranslatorOutput['amendments'] = [];
      if (amendmentsMatch) {
        const objRegex = /\{[^{}]*\}/g;
        let m: RegExpExecArray | null;
        while ((m = objRegex.exec(amendmentsMatch[1])) !== null) {
          try {
            const obj = JSON.parse(m[0]);
            amendments.push({
              id: crypto.randomUUID(),
              articleId: String(obj.articleId ?? ''),
              originalText: String(obj.originalText ?? ''),
              proposedText: String(obj.proposedText ?? ''),
              explanation: String(obj.explanation ?? ''),
              status: 'pending' as const,
            });
          } catch {
            // skip malformed amendment object
          }
        }
      }

      return {
        amendments,
        summary: extractField('summary'),
        motivation: extractField('motivation'),
        rationale: extractField('rationale'),
      };
    }
  },
});
