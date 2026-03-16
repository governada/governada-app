/**
 * Review Framework Templates API
 *
 * GET /api/workspace/review-templates?proposalType=TreasuryWithdrawals
 * Returns the default template for the given proposal type from the
 * `review_framework_templates` table.
 *
 * Falls back to a built-in default if no matching template exists in the DB.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import type { ReviewFrameworkTemplate, ReviewChecklistItem } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Built-in fallback templates (used when no DB template exists)
// ---------------------------------------------------------------------------

const FALLBACK_TEMPLATES: Record<string, ReviewChecklistItem[]> = {
  TreasuryWithdrawals: [
    {
      question: 'Is the requested amount proportional to the proposed deliverables?',
      category: 'Fiscal',
      weight: 1,
    },
    {
      question: 'Does the proposer have a track record of delivery?',
      category: 'Trust',
      weight: 1,
    },
    {
      question: 'Are milestones and success criteria clearly defined?',
      category: 'Clarity',
      weight: 1,
    },
    {
      question: 'Is there overlap with existing funded proposals?',
      category: 'Efficiency',
      weight: 1,
    },
    {
      question: 'Does this align with the Cardano Constitution?',
      category: 'Constitutional',
      weight: 1,
    },
    { question: 'Are there alternative, lower-cost approaches?', category: 'Fiscal', weight: 1 },
    {
      question: 'Does the proposal include accountability mechanisms?',
      category: 'Trust',
      weight: 1,
    },
  ],
  ParameterChange: [
    { question: 'Is the technical justification sound?', category: 'Technical', weight: 1 },
    { question: 'Has the impact on existing dApps been assessed?', category: 'Impact', weight: 1 },
    {
      question: 'Is there community consensus on the need for this change?',
      category: 'Governance',
      weight: 1,
    },
    { question: 'Are rollback procedures described?', category: 'Risk', weight: 1 },
    {
      question: 'Does this align with the Cardano Constitution?',
      category: 'Constitutional',
      weight: 1,
    },
  ],
  InfoAction: [
    {
      question: 'Is the signaling intention clear and actionable?',
      category: 'Clarity',
      weight: 1,
    },
    {
      question: 'Does it represent a genuine community sentiment?',
      category: 'Governance',
      weight: 1,
    },
    { question: 'Are there potential unintended consequences?', category: 'Risk', weight: 1 },
    {
      question: 'Does this align with the Cardano Constitution?',
      category: 'Constitutional',
      weight: 1,
    },
  ],
  NewConstitution: [
    {
      question: 'Does the proposed text improve on the current Constitution?',
      category: 'Governance',
      weight: 1,
    },
    { question: 'Has the community had adequate time to review?', category: 'Process', weight: 1 },
    {
      question: 'Are minority viewpoints adequately represented?',
      category: 'Inclusivity',
      weight: 1,
    },
    { question: 'Is the language clear and unambiguous?', category: 'Clarity', weight: 1 },
    { question: 'Are enforcement mechanisms adequate?', category: 'Accountability', weight: 1 },
    { question: 'Does this follow proper amendment procedures?', category: 'Process', weight: 1 },
    { question: 'Has a constitutional expert reviewed the text?', category: 'Trust', weight: 1 },
    { question: 'Are transition provisions included?', category: 'Practicality', weight: 1 },
  ],
  Default: [
    {
      question: 'Is the proposal well-written and clearly motivated?',
      category: 'Clarity',
      weight: 1,
    },
    {
      question: 'Does this align with the Cardano Constitution?',
      category: 'Constitutional',
      weight: 1,
    },
    { question: 'Are there risks or unintended consequences?', category: 'Risk', weight: 1 },
    { question: 'Does the proposer have relevant credibility?', category: 'Trust', weight: 1 },
    { question: 'Is there broad community benefit?', category: 'Impact', weight: 1 },
  ],
};

function getFallbackTemplate(proposalType: string): ReviewFrameworkTemplate {
  const checklist = FALLBACK_TEMPLATES[proposalType] ?? FALLBACK_TEMPLATES['Default'];
  return {
    id: `fallback-${proposalType}`,
    proposalType,
    name: `${proposalType} Review Framework`,
    description: `Default review checklist for ${proposalType} proposals`,
    checklist,
    isDefault: true,
  };
}

export const GET = withRouteHandler(async (request) => {
  const proposalType = request.nextUrl.searchParams.get('proposalType');

  if (!proposalType) {
    return NextResponse.json({ error: 'Missing proposalType' }, { status: 400 });
  }

  const supabase = createClient();

  // Try to fetch from DB first
  const { data, error } = await supabase
    .from('review_framework_templates')
    .select('*')
    .eq('proposal_type', proposalType)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Fall back to built-in templates
    const template = getFallbackTemplate(proposalType);
    return NextResponse.json({ template });
  }

  const template: ReviewFrameworkTemplate = {
    id: data.id,
    proposalType: data.proposal_type,
    name: data.name,
    description: data.description,
    checklist: data.checklist as ReviewChecklistItem[],
    isDefault: data.is_default,
  };

  return NextResponse.json({ template });
});
