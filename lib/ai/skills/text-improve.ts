/**
 * Skill: Text Improve
 *
 * The "Cursor moment" — takes selected text and returns an improved version.
 * Also used for reviewer "Explain" action via the instruction parameter.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';

const inputSchema = z.object({
  selectedText: z.string().min(1),
  surroundingContext: z.string(),
  proposalType: z.string(),
  instruction: z.string().optional(),
});

type Input = z.infer<typeof inputSchema>;

export interface TextImproveOutput {
  improvedText: string;
  explanation: string;
}

registerSkill<Input, TextImproveOutput>({
  name: 'text-improve',
  description: 'Improve selected governance proposal text or explain a passage.',
  category: 'shared',
  inputSchema,
  model: 'FAST',
  maxTokens: 1024,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance writing assistant. You help improve or explain governance proposal text.

${ctx.personalContextStr ? `The user's governance perspective:\n${ctx.personalContextStr}\n\nTailor your improvements and explanations to THIS person's governance values.` : ''}

Return ONLY valid JSON with this structure:
{
  "improvedText": "the improved or explanatory text",
  "explanation": "brief explanation of what changed and why (1-2 sentences)"
}

When improving text:
- Make it more specific, concrete, and evidence-based
- Reference the Cardano Constitution where relevant
- Replace vague language with measurable claims
- Maintain the author's voice and intent
- Keep the same approximate length unless specificity requires expansion

When explaining text (instruction provided):
- Set "improvedText" to a clear, plain-language explanation
- Frame the explanation in terms of the reader's governance perspective
- Reference relevant constitutional articles or governance context`,

  buildPrompt: (input: Input) => {
    const parts = [`Proposal type: ${input.proposalType}`, ''];
    if (input.instruction) {
      parts.push(`Instruction: ${input.instruction}`, '');
    }
    parts.push(`Selected text to ${input.instruction ? 'explain' : 'improve'}:`);
    parts.push(`"${input.selectedText}"`, '');
    if (input.surroundingContext) {
      parts.push('Surrounding context:', input.surroundingContext, '');
    }
    parts.push('Return valid JSON only.');
    return parts.join('\n');
  },

  parseOutput: (raw: string): TextImproveOutput => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        improvedText: String(parsed.improvedText ?? ''),
        explanation: String(parsed.explanation ?? ''),
      };
    } catch {
      // Try to extract from malformed JSON
      const textMatch = raw.match(/"improvedText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const explMatch = raw.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);

      return {
        improvedText: textMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') ?? '',
        explanation: explMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') ?? '',
      };
    }
  },
});
