/**
 * Skill: Personalized Briefing
 *
 * Generates a personalized proposal summary and alignment assessment
 * for a reviewer, based on their governance philosophy and voting history.
 *
 * The personal context is injected automatically by the skill engine —
 * the skill input only needs proposal data.
 *
 * Graceful degradation: when personal context is empty (new user),
 * produces a generic summary equivalent to the current static behavior.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import { parseJsonSafe, safeEnum } from './parse-helpers';
import type { SkillContext } from './types';

const inputSchema = z.object({
  proposalContent: z.object({
    title: z.string(),
    abstract: z.string(),
    motivation: z.string(),
    rationale: z.string(),
  }),
  proposalType: z.string(),
  interBodyVotes: z
    .object({
      drep: z.object({ yes: z.number(), no: z.number(), abstain: z.number() }),
      spo: z.object({ yes: z.number(), no: z.number(), abstain: z.number() }),
      cc: z.object({ yes: z.number(), no: z.number(), abstain: z.number() }),
    })
    .optional(),
  withdrawalAmount: z.number().optional(),
});

type Input = z.infer<typeof inputSchema>;

export interface PersonalizedBriefingOutput {
  personalizedSummary: string;
  alignmentSignal: {
    label: string;
    explanation: string;
    direction: 'aligned' | 'misaligned' | 'neutral';
  };
  quickTakeaway: string;
  keyTensions: Array<{ aspect: string; yourPosition: string; proposalPosition: string }>;
}

registerSkill<Input, PersonalizedBriefingOutput>({
  name: 'personalized-briefing',
  description:
    'Generate a personalized proposal briefing with alignment assessment for a specific reviewer.',
  category: 'review',
  inputSchema,
  model: 'FAST',
  maxTokens: 1536,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance briefing analyst. Generate a personalized proposal summary for a specific reviewer.

${
  ctx.personalContextStr
    ? `THIS REVIEWER'S GOVERNANCE PROFILE:\n${ctx.personalContextStr}\n\nIMPORTANT: Reference their specific voting history and governance philosophy. Don't be generic — mention past votes, policy stances, and alignment patterns that are relevant to this proposal. Frame tensions in terms of THEIR established positions.`
    : 'No reviewer profile available. Generate a neutral, informative summary without personalization.'
}

Return ONLY valid JSON:
{
  "personalizedSummary": "2-3 paragraphs. If reviewer profile available: reference their voting history, philosophy alignment, and how this proposal relates to their established positions. If no profile: provide a clear, informative summary.",
  "alignmentSignal": {
    "label": "Short signal (e.g., 'Aligns with your treasury stance', 'Conflicts with your decentralization priority')",
    "explanation": "1-2 sentences explaining why",
    "direction": "aligned|misaligned|neutral"
  },
  "quickTakeaway": "One sentence: the single most important thing for this reviewer to know",
  "keyTensions": [{"aspect": "e.g., Treasury sustainability", "yourPosition": "What the reviewer has historically supported", "proposalPosition": "What this proposal does differently"}]
}

Guidelines:
- If no reviewer profile: set alignmentSignal.direction to "neutral" and omit keyTensions
- Keep personalizedSummary under 1000 characters
- quickTakeaway must be a single sentence under 200 characters
- Maximum 3 keyTensions`,

  buildPrompt: (input: Input) => {
    const parts = [
      `Proposal: "${input.proposalContent.title}"`,
      `Type: ${input.proposalType}`,
      `Abstract: ${input.proposalContent.abstract}`,
      `Motivation: ${input.proposalContent.motivation}`,
      `Rationale: ${input.proposalContent.rationale}`,
    ];
    if (input.interBodyVotes) {
      const { drep, spo, cc } = input.interBodyVotes;
      parts.push(
        `\nCurrent votes — DReps: ${drep.yes}Y/${drep.no}N/${drep.abstain}A, SPOs: ${spo.yes}Y/${spo.no}N/${spo.abstain}A, CC: ${cc.yes}Y/${cc.no}N/${cc.abstain}A`,
      );
    }
    if (input.withdrawalAmount) {
      parts.push(`Treasury withdrawal: ₳${input.withdrawalAmount.toLocaleString()}`);
    }
    parts.push('\nGenerate a personalized briefing for this reviewer. Return valid JSON only.');
    return parts.join('\n');
  },

  parseOutput: (raw: string): PersonalizedBriefingOutput => {
    const parsed = parseJsonSafe(raw);
    if (!parsed) {
      return {
        personalizedSummary: raw.slice(0, 1500),
        alignmentSignal: { label: 'Analysis pending', explanation: '', direction: 'neutral' },
        quickTakeaway: '',
        keyTensions: [],
      };
    }
    const signal = (parsed.alignmentSignal ?? {}) as Record<string, unknown>;
    return {
      personalizedSummary: String(parsed.personalizedSummary ?? '').slice(0, 1500),
      alignmentSignal: {
        label: String(signal.label ?? 'Review pending'),
        explanation: String(signal.explanation ?? ''),
        direction: safeEnum(
          signal.direction as string,
          ['aligned', 'misaligned', 'neutral'],
          'neutral',
        ),
      },
      quickTakeaway: String(parsed.quickTakeaway ?? '').slice(0, 300),
      keyTensions: Array.isArray(parsed.keyTensions)
        ? parsed.keyTensions.slice(0, 3).map((t: Record<string, unknown>) => ({
            aspect: String(t.aspect ?? ''),
            yourPosition: String(t.yourPosition ?? ''),
            proposalPosition: String(t.proposalPosition ?? ''),
          }))
        : [],
    };
  },
});
