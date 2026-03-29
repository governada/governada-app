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
    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      const articles = Array.isArray(parsed.articles)
        ? parsed.articles.map((a: Record<string, unknown>) => ({
            article: String(a.article ?? ''),
            verdict: (['PASS', 'ADVISORY', 'FAIL'].includes(a.verdict as string)
              ? a.verdict
              : 'ADVISORY') as 'PASS' | 'ADVISORY' | 'FAIL',
            reasoning: String(a.reasoning ?? ''),
            confidence: typeof a.confidence === 'number' ? a.confidence : 0.5,
            keyQuote: a.keyQuote ? String(a.keyQuote) : undefined,
          }))
        : [];

      return {
        articles,
        overallVerdict: (['PASS', 'ADVISORY', 'FAIL'].includes(parsed.overallVerdict)
          ? parsed.overallVerdict
          : articles.some((a: ArticleAssessment) => a.verdict === 'FAIL')
            ? 'FAIL'
            : articles.some((a: ArticleAssessment) => a.verdict === 'ADVISORY')
              ? 'ADVISORY'
              : 'PASS') as 'PASS' | 'ADVISORY' | 'FAIL',
        summary: String(parsed.summary ?? ''),
      };
    } catch {
      return {
        articles: [],
        overallVerdict: 'ADVISORY',
        summary: 'Assessment could not be parsed.',
      };
    }
  },

  // Validation pass: verify constitutional article references
  validationPass: {
    systemPrompt:
      'You are a Cardano Constitution reference validator. Verify that all cited constitutional articles are real articles from the Cardano Constitution. Remove any fabricated articles.',
    maxTokens: 2048,

    buildPrompt: (_input: Input, output: CCArticleAssessmentOutput) => {
      if (output.articles.length === 0) {
        return `No articles to validate. Return: ${JSON.stringify(output)}`;
      }
      return `Validate these constitutional article assessments:

${JSON.stringify(output.articles.map((a) => ({ article: a.article, verdict: a.verdict })))}

Remove any articles that don't exist in the Cardano Constitution. Keep all valid articles with their original verdicts and reasoning.

Return ONLY valid JSON with the same structure:
{"articles": [...validated articles...], "overallVerdict": "...", "summary": "..."}`;
    },

    parseValidation: (
      raw: string,
      original: CCArticleAssessmentOutput,
    ): CCArticleAssessmentOutput => {
      try {
        const cleaned = raw
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '')
          .trim();
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed.articles)) return original;

        const validatedArticles = parsed.articles.map((a: Record<string, unknown>) => ({
          article: String(a.article ?? ''),
          verdict: (['PASS', 'ADVISORY', 'FAIL'].includes(a.verdict as string)
            ? a.verdict
            : 'ADVISORY') as 'PASS' | 'ADVISORY' | 'FAIL',
          reasoning: String(a.reasoning ?? ''),
          confidence: typeof a.confidence === 'number' ? a.confidence : 0.5,
          keyQuote: a.keyQuote ? String(a.keyQuote) : undefined,
        }));

        return {
          articles: validatedArticles,
          overallVerdict: (['PASS', 'ADVISORY', 'FAIL'].includes(parsed.overallVerdict)
            ? parsed.overallVerdict
            : original.overallVerdict) as 'PASS' | 'ADVISORY' | 'FAIL',
          summary: String(parsed.summary ?? original.summary),
        };
      } catch {
        return original;
      }
    },
  },
});
