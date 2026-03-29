/**
 * Skill: Feedback Synthesis
 *
 * Clusters feedback themes into severity-ranked groups (Critical/Important/Minor)
 * with suggested responses and optional edit instructions for the proposer.
 *
 * Consumes the output of the Inngest `consolidate-feedback` function
 * (stored in `proposal_feedback_themes` table) and produces actionable
 * synthesis that feeds the FeedbackTriageBoard.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import { parseJsonSafe, safeParseArray, safeEnum } from './parse-helpers';
import type { SkillContext } from './types';

const inputSchema = z.object({
  themes: z.array(
    z.object({
      id: z.string(),
      summary: z.string(),
      category: z.enum(['concern', 'support', 'question', 'suggestion']),
      endorsementCount: z.number(),
      keyVoices: z.array(z.object({ text: z.string() })),
    }),
  ),
  proposalContent: z.object({
    title: z.string(),
    abstract: z.string(),
    motivation: z.string(),
    rationale: z.string(),
  }),
  proposalType: z.string(),
});

type Input = z.infer<typeof inputSchema>;

interface SynthesisCluster {
  severity: 'critical' | 'important' | 'minor';
  label: string;
  themeIds: string[];
  suggestedResponse: string;
  suggestedEdit?: {
    field: 'title' | 'abstract' | 'motivation' | 'rationale';
    instruction: string;
  };
}

export interface FeedbackSynthesisOutput {
  clusters: SynthesisCluster[];
  overallAssessment: string;
  unaddressedRiskSummary: string;
}

registerSkill<Input, FeedbackSynthesisOutput>({
  name: 'feedback-synthesis',
  description:
    'Synthesize feedback themes into severity-ranked clusters with suggested responses and edit instructions.',
  category: 'authoring',
  inputSchema,
  model: 'FAST',
  maxTokens: 2048,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance proposal revision advisor. Analyze consolidated reviewer feedback themes and synthesize them into actionable revision guidance.

${ctx.personalContextStr ? `The proposer's governance perspective:\n${ctx.personalContextStr}\n\nFrame suggestions in terms of what would strengthen the proposal given THIS proposer's established priorities.` : ''}

Return ONLY valid JSON:
{
  "clusters": [
    {
      "severity": "critical|important|minor",
      "label": "Short descriptive label (e.g., 'Treasury sustainability not addressed')",
      "themeIds": ["theme_id_1", "theme_id_2"],
      "suggestedResponse": "2-3 sentence suggested revision approach",
      "suggestedEdit": {
        "field": "abstract|motivation|rationale",
        "instruction": "Specific edit instruction (e.g., 'Add a paragraph addressing treasury sustainability with a 3-year cost projection')"
      }
    }
  ],
  "overallAssessment": "1-2 sentences: overall state of the feedback and recommended priority",
  "unaddressedRiskSummary": "1 sentence: what's at risk if critical items aren't addressed"
}

Severity classification:
- critical: 5+ endorsements OR constitutional concern OR multiple reviewers flagged independently
- important: 2-4 endorsements OR substantive quality gap
- minor: 1 endorsement OR stylistic/minor suggestion

Guidelines:
- Group related themes into the same cluster (max 5 clusters)
- Every cluster should have a suggestedResponse
- Only include suggestedEdit for critical and important clusters where a specific text change would help
- suggestedEdit.instruction must be specific enough for an AI to execute (not "improve" but "add a section on...")
- If themes are mostly supportive, say so in overallAssessment — don't manufacture concerns`,

  buildPrompt: (input: Input) => {
    const parts = [
      `Proposal: "${input.proposalContent.title}" (${input.proposalType})`,
      '',
      `Feedback themes (${input.themes.length} total):`,
    ];
    for (const theme of input.themes) {
      parts.push(
        `- [${theme.category}] ${theme.summary} (${theme.endorsementCount} endorsements, ID: ${theme.id})`,
      );
      if (theme.keyVoices.length > 0) {
        parts.push(`  Key voice: "${theme.keyVoices[0].text.slice(0, 200)}"`);
      }
    }
    parts.push(
      '',
      'Proposal content for context:',
      `Abstract: ${input.proposalContent.abstract.slice(0, 500)}`,
      `Motivation: ${input.proposalContent.motivation.slice(0, 500)}`,
      `Rationale: ${input.proposalContent.rationale.slice(0, 500)}`,
      '',
      'Synthesize these themes into severity-ranked clusters. Return valid JSON only.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): FeedbackSynthesisOutput => {
    const parsed = parseJsonSafe(raw);
    if (!parsed) return { clusters: [], overallAssessment: '', unaddressedRiskSummary: '' };

    return {
      clusters: safeParseArray(parsed.clusters, (c) => {
        const edit = c.suggestedEdit as Record<string, unknown> | undefined;
        return {
          severity: safeEnum(c.severity as string, ['critical', 'important', 'minor'], 'minor'),
          label: String(c.label ?? ''),
          themeIds: Array.isArray(c.themeIds) ? c.themeIds.map((id: unknown) => String(id)) : [],
          suggestedResponse: String(c.suggestedResponse ?? ''),
          suggestedEdit: edit
            ? {
                field: safeEnum(
                  edit.field as string,
                  ['title', 'abstract', 'motivation', 'rationale'],
                  'rationale',
                ),
                instruction: String(edit.instruction ?? ''),
              }
            : undefined,
        };
      }),
      overallAssessment: String(parsed.overallAssessment ?? ''),
      unaddressedRiskSummary: String(parsed.unaddressedRiskSummary ?? ''),
    };
  },
});
