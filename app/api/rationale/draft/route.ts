/**
 * AI Rationale Draft API
 * Generates a structured rationale draft using Anthropic, personalized to the
 * DRep's or SPO's stated objectives and the proposal's content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDRepById } from '@/lib/data';
import { captureServerEvent } from '@/lib/posthog-server';
import { createClient } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { RationaleDraftSchema } from '@/lib/api/schemas/governance';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = withRouteHandler(
  async (request: NextRequest, { requestId }: RouteContext) => {
    const { drepId, voterRole, proposalTitle, proposalAbstract, proposalType, aiSummary } =
      RationaleDraftSchema.parse(await request.json());

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI features not configured' }, { status: 503 });
    }

    let voterContext = '';
    let voterLabel = 'DRep (Delegated Representative)';

    if (voterRole === 'spo') {
      // Look up SPO pool info for context
      voterLabel = 'SPO (Stake Pool Operator)';
      const supabase = createClient();
      const { data: pool } = await supabase
        .from('pools')
        .select('pool_name, ticker, governance_statement')
        .eq('pool_id', drepId)
        .single();

      if (pool) {
        const parts = [
          pool.pool_name && `Pool: ${pool.pool_name} (${pool.ticker || 'N/A'})`,
          pool.governance_statement &&
            `Governance Statement: ${pool.governance_statement.slice(0, 500)}`,
        ].filter(Boolean);
        voterContext = parts.join('\n');
      }
    } else {
      // DRep context
      const drep = await getDRepById(drepId);
      if (drep) {
        const metadata = drep.metadata || {};
        const objectives = (metadata.objectives as string) || '';
        const motivations = (metadata.motivations as string) || '';
        const qualifications = (metadata.qualifications as string) || '';
        voterContext = [
          objectives && `Objectives: ${objectives}`,
          motivations && `Motivations: ${motivations}`,
          qualifications && `Qualifications: ${qualifications}`,
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    const proposalContext = [
      `Title: ${proposalTitle}`,
      proposalType && `Type: ${proposalType}`,
      proposalAbstract && `Abstract: ${proposalAbstract}`,
      aiSummary && `Summary: ${aiSummary}`,
    ]
      .filter(Boolean)
      .join('\n');

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are helping a Cardano ${voterLabel} write a CIP-100 compatible voting rationale for a governance proposal.

PROPOSAL:
${proposalContext}

${voterContext ? `VOTER'S STATED VALUES AND CONTEXT:\n${voterContext}\n` : ''}
Write a professional, structured voting rationale draft. The voter will review and edit this before submitting. Include:

1. **Context**: Brief summary of what this proposal does (1-2 sentences)
2. **Analysis**: Key considerations, trade-offs, and implications (2-3 bullet points)
3. **Position**: A template position statement the voter can customize (leave the actual vote choice as [SUPPORT/OPPOSE/ABSTAIN] for them to fill in)

Keep it concise (under 300 words), factual, and neutral in tone. Do not make assumptions about the voter's choice. Reference the voter's stated objectives where relevant to help them frame their position.

Output only the rationale text, no preamble.`,
        },
      ],
    });

    const draft = message.content[0].type === 'text' ? message.content[0].text : '';

    captureServerEvent('rationale_ai_drafted', { voter_id: drepId, voter_role: voterRole }, drepId);

    return NextResponse.json({ draft });
  },
  { auth: 'none', rateLimit: { max: 10, window: 60 } },
);
