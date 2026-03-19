/**
 * Skill: Readiness Narrative
 *
 * Generates a 1-2 sentence actionable insight about proposal readiness,
 * grounded in the proposal's actual state and common patterns from
 * governance proposals. Displayed in the ReadinessPanel as the "oh wow" moment.
 */

import { z } from 'zod';
import { registerSkill } from './registry';

const inputSchema = z.object({
  proposalType: z.string(),
  title: z.string(),
  abstract: z.string(),
  motivation: z.string(),
  rationale: z.string(),
  confidenceScore: z.number().min(0).max(100),
  confidenceLevel: z.enum(['low', 'moderate', 'high', 'strong']),
  blockerLabels: z.array(z.string()),
  recommendationLabels: z.array(z.string()),
  constitutionalCheck: z.enum(['pass', 'warning', 'fail']).nullable(),
  reviewCount: z.number(),
});

type Input = z.infer<typeof inputSchema>;

export interface ReadinessNarrativeOutput {
  narrative: string;
  actionItem: string | null;
}

registerSkill<Input, ReadinessNarrativeOutput>({
  name: 'readiness-narrative',
  description: 'Generate a concise, actionable readiness insight for a governance proposal.',
  category: 'authoring',
  inputSchema,
  model: 'FAST',
  maxTokens: 256,

  systemPrompt: `You are a Cardano governance advisor. Given a proposal's readiness state, produce a concise, actionable insight in 1-2 sentences.

Your response tells the author what specifically would most improve their proposal's chance of passing, based on the proposal type and current state. Be specific and grounded — reference the actual content gaps or strengths you see.

Return ONLY valid JSON:
{
  "narrative": "1-2 sentence insight about the proposal's readiness state and what would most improve it",
  "actionItem": "Single most impactful action, or null if proposal is ready"
}

Guidelines:
- Be specific to THIS proposal, not generic advice
- Reference the proposal type when relevant (e.g., treasury proposals need budget specifics)
- If the proposal is ready (strong confidence), acknowledge it and note any final polish opportunities
- If there are blockers, focus on the highest-impact one
- Keep the tone professional and encouraging, not critical
- Never say "consider" — be direct about what to do`,

  buildPrompt: (input: Input) => {
    const parts = [
      `Proposal type: ${input.proposalType}`,
      `Title: ${input.title}`,
      `Confidence: ${input.confidenceScore}% (${input.confidenceLevel})`,
      `Constitutional check: ${input.constitutionalCheck ?? 'Not run'}`,
      `Reviews: ${input.reviewCount}`,
      '',
    ];

    if (input.blockerLabels.length > 0) {
      parts.push(`Blockers: ${input.blockerLabels.join('; ')}`);
    }
    if (input.recommendationLabels.length > 0) {
      parts.push(`Recommendations: ${input.recommendationLabels.join('; ')}`);
    }

    parts.push('', 'Content summary:');
    parts.push(`Abstract (${input.abstract.length} chars): ${input.abstract.slice(0, 300)}`);
    parts.push(`Motivation (${input.motivation.length} chars): ${input.motivation.slice(0, 300)}`);
    parts.push(`Rationale (${input.rationale.length} chars): ${input.rationale.slice(0, 300)}`);
    parts.push('', 'Generate the readiness narrative. Return valid JSON only.');

    return parts.join('\n');
  },

  parseOutput: (raw: string): ReadinessNarrativeOutput => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        narrative: String(parsed.narrative ?? 'Analysis complete.'),
        actionItem: parsed.actionItem ? String(parsed.actionItem) : null,
      };
    } catch {
      return {
        narrative: 'Unable to generate readiness analysis.',
        actionItem: null,
      };
    }
  },
});
