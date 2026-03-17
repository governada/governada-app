/**
 * Skill: Section Analysis
 *
 * Workhorse skill for inline intelligence — analyzes a single proposal section
 * and returns constitutional flags, completeness gaps, vagueness issues, and
 * an overall quality assessment in one call.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';

const inputSchema = z.object({
  field: z.enum(['abstract', 'motivation', 'rationale']),
  content: z.string().min(1),
  proposalType: z.string(),
  fullDraftContext: z
    .object({
      title: z.string(),
      abstract: z.string(),
      motivation: z.string(),
      rationale: z.string(),
    })
    .optional(),
});

type Input = z.infer<typeof inputSchema>;

interface ConstitutionalFlag {
  article: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

interface CompletenessGap {
  label: string;
  suggestion: string;
}

interface VaguenessIssue {
  text: string;
  suggestion: string;
}

export interface SectionAnalysisOutput {
  constitutionalFlags: ConstitutionalFlag[];
  completenessGaps: CompletenessGap[];
  vaguenessIssues: VaguenessIssue[];
  overallQuality: 'strong' | 'adequate' | 'needs_work';
  summary: string;
}

registerSkill<Input, SectionAnalysisOutput>({
  name: 'section-analysis',
  description:
    'Analyze a single proposal section for constitutional compliance, completeness, and clarity.',
  category: 'shared',
  inputSchema,
  model: 'FAST',
  maxTokens: 1024,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance proposal analyst. Analyze one section of a governance proposal for quality, constitutional compliance, and completeness.

${ctx.personalContextStr ? `The reader's governance perspective:\n${ctx.personalContextStr}\n\nPrioritize constitutional concerns and completeness gaps that matter most to THIS person.` : ''}

Return ONLY valid JSON with this structure:
{
  "constitutionalFlags": [{"article": "Article X", "concern": "explanation", "severity": "info|warning|critical"}],
  "completenessGaps": [{"label": "Missing element", "suggestion": "What to add"}],
  "vaguenessIssues": [{"text": "vague phrase from the text", "suggestion": "more specific alternative"}],
  "overallQuality": "strong|adequate|needs_work",
  "summary": "One-sentence assessment of this section"
}

Guidelines:
- constitutionalFlags: Only flag real constitutional concerns with specific article references. Empty array if none.
- completenessGaps: What a strong proposal section of this type would include that this one is missing. Max 3 items.
- vaguenessIssues: Phrases that are too abstract or generic. Quote the actual text, suggest a concrete replacement. Max 3 items.
- overallQuality: "strong" = publication-ready, "adequate" = functional but improvable, "needs_work" = significant gaps
- summary: One sentence, direct, actionable. Not generic praise.`,

  buildPrompt: (input: Input) => {
    const fieldLabels = { abstract: 'Abstract', motivation: 'Motivation', rationale: 'Rationale' };
    const parts = [
      `Proposal type: ${input.proposalType}`,
      `Section: ${fieldLabels[input.field]}`,
      '',
      `Content to analyze:`,
      input.content,
    ];
    if (input.fullDraftContext) {
      parts.push(
        '',
        'Other sections for cross-reference:',
        `Title: ${input.fullDraftContext.title}`,
      );
      if (input.field !== 'abstract' && input.fullDraftContext.abstract) {
        parts.push(`Abstract: ${input.fullDraftContext.abstract.slice(0, 500)}`);
      }
      if (input.field !== 'motivation' && input.fullDraftContext.motivation) {
        parts.push(`Motivation: ${input.fullDraftContext.motivation.slice(0, 500)}`);
      }
      if (input.field !== 'rationale' && input.fullDraftContext.rationale) {
        parts.push(`Rationale: ${input.fullDraftContext.rationale.slice(0, 500)}`);
      }
    }
    parts.push('', 'Analyze this section. Return valid JSON only.');
    return parts.join('\n');
  },

  parseOutput: (raw: string): SectionAnalysisOutput => {
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        constitutionalFlags: Array.isArray(parsed.constitutionalFlags)
          ? parsed.constitutionalFlags
          : [],
        completenessGaps: Array.isArray(parsed.completenessGaps) ? parsed.completenessGaps : [],
        vaguenessIssues: Array.isArray(parsed.vaguenessIssues) ? parsed.vaguenessIssues : [],
        overallQuality: ['strong', 'adequate', 'needs_work'].includes(parsed.overallQuality)
          ? parsed.overallQuality
          : 'adequate',
        summary: String(parsed.summary ?? 'Analysis complete.'),
      };
    } catch {
      return {
        constitutionalFlags: [],
        completenessGaps: [],
        vaguenessIssues: [],
        overallQuality: 'adequate',
        summary: 'Analysis could not be parsed. Please try again.',
      };
    }
  },
});
