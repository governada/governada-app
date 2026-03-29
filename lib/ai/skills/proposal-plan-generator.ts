/**
 * Skill: Proposal Plan Generator
 *
 * Generates a comprehensive Proposal Plan from guided scaffold answers:
 * - CIP-108 compliant draft (title, abstract, motivation, rationale)
 * - Constitutional assessment with article-level flags
 * - Risk analysis (constitutional, political, financial)
 * - Similar proposals with outcomes
 * - Recommended improvements with confidence scores
 *
 * This is the evolved version of `proposal-draft-generator` — same inputs,
 * richer structured output. Personalized to author's governance philosophy.
 */

import { z } from 'zod';
import { registerSkill } from './registry';
import type { SkillContext } from './types';

const inputSchema = z.object({
  proposalType: z.string().min(1),
  scaffoldAnswers: z.record(z.string(), z.string()),
});

type Input = z.infer<typeof inputSchema>;

interface ConstitutionalFlag {
  article: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

interface Risk {
  label: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
}

interface SimilarProposal {
  title: string;
  type: string;
  outcome: string;
  relevance: string;
}

interface Improvement {
  field: string;
  suggestion: string;
  confidence: number;
  source: string;
}

export interface ProposalPlanOutput {
  draft: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
    typeSpecific?: Record<string, unknown>;
  };
  constitutionalAssessment: {
    score: 'pass' | 'warning' | 'fail';
    flags: ConstitutionalFlag[];
    summary: string;
  };
  riskAnalysis: {
    risks: Risk[];
    overallRisk: 'low' | 'medium' | 'high';
  };
  similarProposals: {
    proposals: SimilarProposal[];
    precedentSummary: string;
  };
  improvements: Improvement[];
}

registerSkill<Input, ProposalPlanOutput>({
  name: 'proposal-plan-generator',
  description:
    'Generate a comprehensive Proposal Plan: CIP-108 draft + constitutional assessment + risk analysis + similar proposals + recommended improvements.',
  category: 'authoring',
  inputSchema,
  model: 'DRAFT',
  maxTokens: 8192,
  requiresAuth: true,

  systemPrompt: (ctx: SkillContext) =>
    `You are a Cardano governance proposal strategist. Generate a comprehensive Proposal Plan that gives the author everything they need to submit a strong proposal.

${ctx.personalContextStr ? `The author's governance perspective:\n${ctx.personalContextStr}\n\nTailor the proposal's framing, risk assessment, and improvement suggestions to reflect THIS author's governance values and priorities.` : ''}

Return ONLY valid JSON with this exact structure:
{
  "draft": {
    "title": "Concise proposal title (max 200 characters)",
    "abstract": "Clear summary (max 2000 characters)",
    "motivation": "Why needed, problem, beneficiaries (max 10000 characters)",
    "rationale": "Why correct, evidence, trade-offs, why vote Yes (max 10000 characters)"
  },
  "constitutionalAssessment": {
    "score": "pass|warning|fail",
    "flags": [{"article": "Article X", "concern": "explanation", "severity": "info|warning|critical"}],
    "summary": "One-sentence compliance assessment"
  },
  "riskAnalysis": {
    "risks": [{"label": "Risk name", "severity": "low|medium|high", "mitigation": "How to address"}],
    "overallRisk": "low|medium|high"
  },
  "similarProposals": {
    "proposals": [{"title": "Prior proposal", "type": "InfoAction", "outcome": "Passed/Failed/Expired", "relevance": "Why relevant"}],
    "precedentSummary": "What precedent means for this proposal"
  },
  "improvements": [{"field": "abstract|motivation|rationale", "suggestion": "Specific improvement", "confidence": 0.8, "source": "constitutional|precedent|quality"}]
}

Guidelines:
- Write in a professional, clear tone appropriate for governance proposals
- Be specific and evidence-based, not vague or aspirational
- Flag real constitutional concerns — don't invent issues where none exist
- Risk analysis should cover: constitutional, political (community reception), and financial risks
- Similar proposals should reference actual governance action types, not invented proposals
- Improvements should be actionable and ranked by confidence (0-1)
- For treasury proposals, include budget justification and sustainability analysis
- For parameter changes, include technical impact analysis
- If no constitutional concerns, score "pass" with empty flags array`,

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
      'Generate a comprehensive Proposal Plan based on these answers. Include all five sections: draft, constitutionalAssessment, riskAnalysis, similarProposals, and improvements. Return valid JSON only.',
    );
    return parts.join('\n');
  },

  parseOutput: (raw: string): ProposalPlanOutput => {
    const fallbackAssessment = { score: 'pass' as const, flags: [], summary: '' };
    const fallbackRisk = { risks: [], overallRisk: 'low' as const };
    const fallbackSimilar = { proposals: [], precedentSummary: '' };

    try {
      const cleaned = raw
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      // Extract draft with length limits
      const draft = parsed.draft ?? parsed;
      const planDraft = {
        title: String(draft.title ?? '').slice(0, 200),
        abstract: String(draft.abstract ?? '').slice(0, 2000),
        motivation: String(draft.motivation ?? '').slice(0, 10000),
        rationale: String(draft.rationale ?? '').slice(0, 10000),
        typeSpecific: draft.typeSpecific ?? undefined,
      };

      // Extract constitutional assessment
      const ca = parsed.constitutionalAssessment ?? fallbackAssessment;
      const constitutionalAssessment = {
        score: (['pass', 'warning', 'fail'].includes(ca.score) ? ca.score : 'pass') as
          | 'pass'
          | 'warning'
          | 'fail',
        flags: Array.isArray(ca.flags)
          ? ca.flags.map((f: Record<string, unknown>) => ({
              article: String(f.article ?? ''),
              concern: String(f.concern ?? ''),
              severity: (['info', 'warning', 'critical'].includes(f.severity as string)
                ? f.severity
                : 'info') as 'info' | 'warning' | 'critical',
            }))
          : [],
        summary: String(ca.summary ?? ''),
      };

      // Extract risk analysis
      const ra = parsed.riskAnalysis ?? fallbackRisk;
      const riskAnalysis = {
        risks: Array.isArray(ra.risks)
          ? ra.risks.map((r: Record<string, unknown>) => ({
              label: String(r.label ?? ''),
              severity: (['low', 'medium', 'high'].includes(r.severity as string)
                ? r.severity
                : 'low') as 'low' | 'medium' | 'high',
              mitigation: String(r.mitigation ?? ''),
            }))
          : [],
        overallRisk: (['low', 'medium', 'high'].includes(ra.overallRisk)
          ? ra.overallRisk
          : 'low') as 'low' | 'medium' | 'high',
      };

      // Extract similar proposals
      const sp = parsed.similarProposals ?? fallbackSimilar;
      const similarProposals = {
        proposals: Array.isArray(sp.proposals)
          ? sp.proposals.map((p: Record<string, unknown>) => ({
              title: String(p.title ?? ''),
              type: String(p.type ?? ''),
              outcome: String(p.outcome ?? ''),
              relevance: String(p.relevance ?? ''),
            }))
          : [],
        precedentSummary: String(sp.precedentSummary ?? ''),
      };

      // Extract improvements
      const improvements = Array.isArray(parsed.improvements)
        ? parsed.improvements.map((i: Record<string, unknown>) => ({
            field: String(i.field ?? ''),
            suggestion: String(i.suggestion ?? ''),
            confidence: typeof i.confidence === 'number' ? i.confidence : 0.5,
            source: String(i.source ?? ''),
          }))
        : [];

      return {
        draft: planDraft,
        constitutionalAssessment,
        riskAnalysis,
        similarProposals,
        improvements,
      };
    } catch {
      // Fallback: attempt to extract just the draft fields
      const extractField = (name: string): string => {
        const regex = new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
        const match = raw.match(regex);
        return match?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') ?? '';
      };
      return {
        draft: {
          title: extractField('title').slice(0, 200),
          abstract: extractField('abstract').slice(0, 2000),
          motivation: extractField('motivation').slice(0, 10000),
          rationale: extractField('rationale').slice(0, 10000),
        },
        constitutionalAssessment: fallbackAssessment,
        riskAnalysis: fallbackRisk,
        similarProposals: fallbackSimilar,
        improvements: [],
      };
    }
  },
});
