/**
 * Skill: Proposal Draft Generator
 *
 * Generates a CIP-108 compliant governance proposal draft from guided scaffold
 * answers. Personalized to the author's governance philosophy and alignment.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';

const inputSchema = z.object({
  proposalType: z.string().min(1),
  scaffoldAnswers: z.record(z.string(), z.string()),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  typeSpecific?: Record<string, unknown>;
}

registerSkill<Input, Output>({
  name: 'proposal-draft-generator',
  description: 'Generate a CIP-108 compliant proposal draft from guided scaffold answers.',
  category: 'authoring',
  inputSchema,
  model: 'FAST',
  maxTokens: 4096,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance proposal writer. Generate a professional CIP-108 compliant governance proposal from the author's scaffold answers.

${ctx.personalContextStr ? `The author's governance perspective:\n${ctx.personalContextStr}\n\nTailor the proposal's framing and emphasis to reflect THIS author's governance values and priorities.` : ''}

Return ONLY valid JSON with this exact structure:
{
  "title": "Concise proposal title (max 200 characters)",
  "abstract": "Clear summary of the proposal (max 2000 characters)",
  "motivation": "Why this proposal is needed, the problem it solves, who benefits (max 10000 characters)",
  "rationale": "Why this approach is correct, evidence, trade-offs considered, why DReps should vote Yes (max 10000 characters)"
}

Guidelines:
- Write in a professional, clear tone appropriate for governance proposals
- Be specific and evidence-based, not vague or aspirational
- The abstract should stand alone as a complete summary
- The motivation should clearly articulate the problem and affected stakeholders
- The rationale should address likely objections and present supporting arguments
- Reference the Cardano Constitution where relevant
- For treasury proposals, include budget justification in the rationale
- For parameter changes, include technical analysis of the impact
- Keep the title under 200 characters, abstract under 2000, motivation and rationale each under 10000`,

  buildPrompt: (input: Input) => {
    const parts = [`Proposal type: ${input.proposalType}`, '', 'Scaffold answers:'];
    for (const [key, value] of Object.entries(input.scaffoldAnswers)) {
      if (value.trim()) {
        const label = key.replace(/_/g, ' ');
        parts.push(`- ${label}: ${value}`);
      }
    }
    parts.push(
      '',
      'Generate a complete CIP-108 governance proposal based on these answers. Return valid JSON only.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): Output => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        title: String(parsed.title ?? '').slice(0, 200),
        abstract: String(parsed.abstract ?? '').slice(0, 2000),
        motivation: String(parsed.motivation ?? '').slice(0, 10000),
        rationale: String(parsed.rationale ?? '').slice(0, 10000),
        typeSpecific: parsed.typeSpecific ?? undefined,
      };
    } catch {
      // Attempt to extract fields from raw text if JSON parsing fails
      const extractField = (name: string): string => {
        const regex = new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
        const match = raw.match(regex);
        return match?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') ?? '';
      };
      return {
        title: extractField('title').slice(0, 200),
        abstract: extractField('abstract').slice(0, 2000),
        motivation: extractField('motivation').slice(0, 10000),
        rationale: extractField('rationale').slice(0, 10000),
      };
    }
  },
});
