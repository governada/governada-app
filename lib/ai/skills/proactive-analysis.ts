/**
 * Skill: Proactive Analysis
 *
 * Analyzes proposal content and surfaces actionable insights the author
 * hasn't asked for. Categories: compliance, completeness, competition,
 * improvement. Deduplicates against previously shown insight IDs.
 *
 * Used by the ProactiveInsightStack component via useProactiveAnalysis hook.
 * Called on a 30s debounce after content changes — not on every keystroke.
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
  constitutionalScore: z.enum(['pass', 'warning', 'fail']).optional(),
  previousInsightIds: z.array(z.string()),
});

type Input = z.infer<typeof inputSchema>;

export interface ProactiveInsight {
  id: string;
  category: 'compliance' | 'completeness' | 'competition' | 'improvement';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  field?: 'title' | 'abstract' | 'motivation' | 'rationale';
  suggestion?: string;
}

export interface ProactiveAnalysisOutput {
  insights: ProactiveInsight[];
}

registerSkill<Input, ProactiveAnalysisOutput>({
  name: 'proactive-analysis',
  description:
    'Analyze proposal content and surface actionable insights the author has not asked for.',
  category: 'authoring',
  inputSchema,
  model: 'FAST',
  maxTokens: 1024,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance proposal advisor. Analyze the proposal and surface 1-3 actionable insights the author may have missed.

${ctx.personalContextStr ? `The author's governance perspective:\n${ctx.personalContextStr}\n\nTailor insights to what matters most given THIS author's governance values.` : ''}

Return ONLY valid JSON:
{
  "insights": [
    {
      "id": "unique_short_id",
      "category": "compliance|completeness|competition|improvement",
      "severity": "info|warning|critical",
      "message": "Clear, specific observation (1-2 sentences max)",
      "field": "abstract|motivation|rationale (which section this applies to, optional)",
      "suggestion": "Specific action the author can take (optional, only if actionable)"
    }
  ]
}

Categories:
- compliance: Constitutional concern the author may not have noticed
- completeness: Missing content that similar successful proposals included
- competition: Competing or related proposals the author should be aware of
- improvement: Specific quality improvement that would strengthen the proposal

Guidelines:
- Return 1-3 insights maximum — quality over quantity
- Each insight must be specific and actionable, not generic advice
- severity "critical" only for constitutional conflicts or blocking issues
- severity "warning" for significant gaps
- severity "info" for helpful improvements
- Do NOT repeat insights whose IDs are in the previousInsightIds list
- Generate fresh IDs (short kebab-case, e.g., "missing-budget-justification")
- If the proposal is strong and you have nothing meaningful to say, return an empty insights array`,

  buildPrompt: (input: Input) => {
    const parts = [
      `Proposal type: ${input.proposalType}`,
      `Title: "${input.proposalContent.title}"`,
      `Abstract: ${input.proposalContent.abstract.slice(0, 500)}`,
      `Motivation: ${input.proposalContent.motivation.slice(0, 500)}`,
      `Rationale: ${input.proposalContent.rationale.slice(0, 500)}`,
    ];
    if (input.constitutionalScore) {
      parts.push(`Current constitutional check: ${input.constitutionalScore}`);
    }
    if (input.previousInsightIds.length > 0) {
      parts.push(`\nAlready shown (do NOT repeat): ${input.previousInsightIds.join(', ')}`);
    }
    parts.push('\nAnalyze and return 1-3 fresh, actionable insights. Return valid JSON only.');
    return parts.join('\n');
  },

  parseOutput: (raw: string): ProactiveAnalysisOutput => {
    const parsed = parseJsonSafe(raw);
    if (!parsed) return { insights: [] };

    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, 3).map((i: Record<string, unknown>) => ({
          id: String(i.id ?? `insight-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
          category: safeEnum(
            i.category as string,
            ['compliance', 'completeness', 'competition', 'improvement'],
            'improvement',
          ),
          severity: safeEnum(i.severity as string, ['info', 'warning', 'critical'], 'info'),
          message: String(i.message ?? '').slice(0, 300),
          field: ['title', 'abstract', 'motivation', 'rationale'].includes(i.field as string)
            ? (i.field as ProactiveInsight['field'])
            : undefined,
          suggestion: i.suggestion ? String(i.suggestion).slice(0, 300) : undefined,
        }))
      : [];

    return { insights };
  },
});
