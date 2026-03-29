/**
 * Skill: Rationale Draft
 *
 * Generates a structured rationale from bullet points after a reviewer
 * selects their vote. Includes constitutional citations, precedent
 * references, and key proposal quotes.
 *
 * Personalized to the reviewer's governance philosophy and voting history
 * via the standard personal context injection.
 *
 * Includes a validation pass to verify constitutional article references
 * are grounded in actual articles (same pattern as constitutional-check).
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import { parseJsonSafe, safeParseArray } from './parse-helpers';
import { filterValidArticles } from './constitution-articles';
import type { SkillContext } from './types';

const inputSchema = z.object({
  vote: z.enum(['Yes', 'No', 'Abstain']),
  bulletPoints: z.string().min(1),
  proposalContent: z.object({
    title: z.string(),
    abstract: z.string(),
    motivation: z.string(),
    rationale: z.string(),
  }),
  proposalType: z.string(),
});

type Input = z.infer<typeof inputSchema>;

interface Citation {
  article: string;
  section?: string;
  relevance: string;
}

interface PrecedentRef {
  title: string;
  outcome: string;
  relevance: string;
}

interface KeyQuote {
  text: string;
  field: string;
}

export interface RationaleDraftOutput {
  structuredRationale: string;
  citations: Citation[];
  precedentRefs: PrecedentRef[];
  keyQuotes: KeyQuote[];
}

registerSkill<Input, RationaleDraftOutput>({
  name: 'rationale-draft',
  description:
    'Generate a structured vote rationale from bullet points, with constitutional citations and precedent references.',
  category: 'review',
  inputSchema,
  model: 'FAST',
  maxTokens: 2048,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance rationale writer. Transform a reviewer's bullet-point reasoning into a well-structured, publishable vote rationale.

${ctx.personalContextStr ? `The reviewer's governance perspective:\n${ctx.personalContextStr}\n\nFrame the rationale to reflect THIS reviewer's governance values, referencing their established positions where relevant.` : ''}

Return ONLY valid JSON with this structure:
{
  "structuredRationale": "Full rationale text, 2-4 paragraphs, ready to publish on-chain (CIP-100 format). Professional tone. Must preserve the reviewer's original reasoning while adding structure, citations, and context.",
  "citations": [{"article": "Article X", "section": "Section Y (optional)", "relevance": "Why this article applies"}],
  "precedentRefs": [{"title": "Prior proposal title", "outcome": "Passed/Failed/Expired", "relevance": "How it relates"}],
  "keyQuotes": [{"text": "Direct quote from proposal", "field": "abstract|motivation|rationale"}]
}

Guidelines:
- The rationale must faithfully represent the reviewer's bullet points — enhance, don't override
- Include 1-3 constitutional citations where the proposal touches constitutional provisions
- Include 0-2 precedent references to similar governance actions
- Include 1-2 key quotes from the proposal that the rationale responds to
- Keep the rationale under 3000 characters (on-chain publishing constraint)
- If voting Yes: emphasize strengths and how concerns are addressed
- If voting No: clearly state concerns with specific references
- If voting Abstain: explain what additional information or changes would resolve uncertainty
- Do not invent constitutional articles — only reference real Cardano Constitution articles`,

  buildPrompt: (input: Input) => {
    const parts = [
      `Vote: ${input.vote}`,
      `Proposal type: ${input.proposalType}`,
      `Proposal title: "${input.proposalContent.title}"`,
      '',
      `Reviewer's bullet points:`,
      input.bulletPoints,
      '',
      'Proposal content:',
      `Abstract: ${input.proposalContent.abstract}`,
      `Motivation: ${input.proposalContent.motivation}`,
      `Rationale: ${input.proposalContent.rationale}`,
      '',
      'Generate a structured rationale that expands these bullet points into a publishable vote rationale. Return valid JSON only.',
    ];
    return parts.join('\n');
  },

  parseOutput: (raw: string): RationaleDraftOutput => {
    const parsed = parseJsonSafe(raw);
    if (!parsed) {
      return {
        structuredRationale: raw.slice(0, 5000),
        citations: [],
        precedentRefs: [],
        keyQuotes: [],
      };
    }
    return {
      structuredRationale: String(parsed.structuredRationale ?? '').slice(0, 5000),
      citations: filterValidArticles(
        safeParseArray(parsed.citations, (c) => ({
          article: String(c.article ?? ''),
          section: c.section ? String(c.section) : undefined,
          relevance: String(c.relevance ?? ''),
        })),
      ),
      precedentRefs: safeParseArray(parsed.precedentRefs, (p) => ({
        title: String(p.title ?? ''),
        outcome: String(p.outcome ?? ''),
        relevance: String(p.relevance ?? ''),
      })),
      keyQuotes: safeParseArray(parsed.keyQuotes, (q) => ({
        text: String(q.text ?? ''),
        field: String(q.field ?? ''),
      })),
    };
  },

  // Citations are validated deterministically in parseOutput via filterValidArticles
  // (no LLM validation pass needed — static lookup against real constitution articles)
});
