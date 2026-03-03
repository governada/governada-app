/**
 * AI Rationale Draft API
 * Generates a structured rationale draft using Anthropic, personalized to the DRep's
 * stated objectives and the proposal's content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDRepById } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { drepId, proposalTitle, proposalAbstract, proposalType, aiSummary } = body;

    if (!drepId || !proposalTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI features not configured' }, { status: 503 });
    }

    const drep = await getDRepById(drepId);
    if (!drep) {
      return NextResponse.json({ error: 'DRep not found' }, { status: 404 });
    }

    const metadata = drep.metadata || {};
    const objectives = (metadata.objectives as string) || '';
    const motivations = (metadata.motivations as string) || '';
    const qualifications = (metadata.qualifications as string) || '';

    const drepContext = [
      objectives && `Objectives: ${objectives}`,
      motivations && `Motivations: ${motivations}`,
      qualifications && `Qualifications: ${qualifications}`,
    ]
      .filter(Boolean)
      .join('\n');

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
          content: `You are helping a Cardano DRep (Delegated Representative) write a CIP-100 compatible voting rationale for a governance proposal.

PROPOSAL:
${proposalContext}

${drepContext ? `DREP'S STATED VALUES AND OBJECTIVES:\n${drepContext}\n` : ''}
Write a professional, structured voting rationale draft. The DRep will review and edit this before submitting. Include:

1. **Context**: Brief summary of what this proposal does (1-2 sentences)
2. **Analysis**: Key considerations, trade-offs, and implications (2-3 bullet points)
3. **Position**: A template position statement the DRep can customize (leave the actual vote choice as [SUPPORT/OPPOSE/ABSTAIN] for them to fill in)

Keep it concise (under 300 words), factual, and neutral in tone. Do not make assumptions about the DRep's vote choice. Reference the DRep's stated objectives where relevant to help them frame their position.

Output only the rationale text, no preamble.`,
        },
      ],
    });

    const draft = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[Rationale Draft API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}
