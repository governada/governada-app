/**
 * Skill: CC Article Assessment
 *
 * Generates article-by-article constitutional assessment for CC members.
 * Each article gets a PASS/ADVISORY/FAIL verdict with reasoning and
 * confidence score. Includes a validation pass to verify article
 * references are real constitutional articles.
 *
 * Used in the CC Express Lane feature to enable one-click accept
 * for compliant proposals.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import { parseJsonSafe, safeParseArray, safeEnum } from './parse-helpers';
import { filterValidArticles } from './constitution-articles';
import type { SkillContext } from './types';

const inputSchema = z.object({
  proposalContent: z.object({
    title: z.string(),
    abstract: z.string(),
    motivation: z.string(),
    rationale: z.string(),
  }),
  proposalType: z.string(),
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

type Input = z.infer<typeof inputSchema>;

interface ArticleAssessment {
  article: string;
  verdict: 'PASS' | 'ADVISORY' | 'FAIL';
  reasoning: string;
  confidence: number;
  keyQuote?: string;
}

export interface CCArticleAssessmentOutput {
  articles: ArticleAssessment[];
  overallVerdict: 'PASS' | 'ADVISORY' | 'FAIL';
  summary: string;
}

registerSkill<Input, CCArticleAssessmentOutput>({
  name: 'cc-article-assessment',
  description:
    'Generate article-by-article constitutional assessment for Constitutional Committee members.',
  category: 'review',
  inputSchema,
  model: 'FAST',
  maxTokens: 3072,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano Constitutional Committee analyst. Perform a thorough article-by-article constitutional assessment of a governance proposal.

${ctx.personalContextStr ? `THIS CC MEMBER'S PERSPECTIVE:\n${ctx.personalContextStr}\n\nFrame your analysis considering this member's prior constitutional interpretations and voting patterns.` : ''}

Return ONLY valid JSON:
{
  "articles": [
    {
      "article": "Article I, Section 1",
      "verdict": "PASS|ADVISORY|FAIL",
      "reasoning": "2-3 sentences explaining the assessment",
      "confidence": 0.85,
      "keyQuote": "Optional: direct quote from the proposal that supports this assessment"
    }
  ],
  "overallVerdict": "PASS|ADVISORY|FAIL",
  "summary": "1-2 sentence overall constitutional assessment"
}

Verdict definitions:
- PASS: No constitutional conflict with this article
- ADVISORY: Potential tension worth noting but not blocking
- FAIL: Clear violation or serious concern requiring attention

Guidelines:
- Assess ONLY articles that are actually relevant to this proposal type and content
- Do NOT list articles that have no relevance (don't pad with "PASS" entries for unrelated articles)
- Typically 3-8 relevant articles per proposal
- confidence is 0-1 (how certain is this assessment)
- keyQuote should be a direct quote from the proposal, not the constitution
- For treasury proposals: always assess Article III (Treasury), Article VII (Economic)
- For parameter changes: always assess Article V (Protocol Parameters)
- overallVerdict: FAIL if any article is FAIL, ADVISORY if any is ADVISORY, PASS otherwise`,

  buildPrompt: (input: Input) => {
    const parts = [
      `Proposal: "${input.proposalContent.title}"`,
      `Type: ${input.proposalType}`,
      `Abstract: ${input.proposalContent.abstract}`,
      `Motivation: ${input.proposalContent.motivation}`,
      `Rationale: ${input.proposalContent.rationale}`,
    ];
    if (input.typeSpecific && Object.keys(input.typeSpecific).length > 0) {
      parts.push(`Type-specific: ${JSON.stringify(input.typeSpecific)}`);
    }
    parts.push(
      '\nPerform an article-by-article constitutional assessment. Only assess relevant articles. Return valid JSON only.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): CCArticleAssessmentOutput => {
    const parsed = parseJsonSafe(raw);
    if (!parsed) {
      return {
        articles: [],
        overallVerdict: 'ADVISORY',
        summary: 'Assessment could not be parsed.',
      };
    }

    // Parse articles and filter to only real constitutional articles
    const articles = filterValidArticles(
      safeParseArray(parsed.articles, (a) => ({
        article: String(a.article ?? ''),
        verdict: safeEnum(a.verdict as string, ['PASS', 'ADVISORY', 'FAIL'], 'ADVISORY'),
        reasoning: String(a.reasoning ?? ''),
        confidence: typeof a.confidence === 'number' ? a.confidence : 0.5,
        keyQuote: a.keyQuote ? String(a.keyQuote) : undefined,
      })),
    );

    // Derive overall verdict from filtered articles
    const hasExplicitVerdict = ['PASS', 'ADVISORY', 'FAIL'].includes(
      parsed.overallVerdict as string,
    );
    const overallVerdict = hasExplicitVerdict
      ? (parsed.overallVerdict as 'PASS' | 'ADVISORY' | 'FAIL')
      : articles.some((a) => a.verdict === 'FAIL')
        ? 'FAIL'
        : articles.some((a) => a.verdict === 'ADVISORY')
          ? 'ADVISORY'
          : 'PASS';

    return {
      articles,
      overallVerdict,
      summary: String(parsed.summary ?? ''),
    };
  },

  // Articles are validated deterministically in parseOutput via filterValidArticles
  // (no LLM validation pass needed — static lookup against real constitution articles)
});
