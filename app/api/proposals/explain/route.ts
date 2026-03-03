/**
 * AI Proposal Explainer — on-demand 3-paragraph explanation of any proposal.
 * Cached in proposals.meta_json.ai_explanation after first generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { generateText } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const enabled = await getFeatureFlag('ai_proposal_explainer');
  if (!enabled) return NextResponse.json({ error: 'Feature disabled' }, { status: 404 });

  try {
    const { txHash, index } = await request.json();
    if (!txHash || index == null) {
      return NextResponse.json({ error: 'Missing txHash or index' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: proposal } = await supabase
      .from('proposals')
      .select('title, abstract, proposal_type, withdrawal_amount, ai_summary, meta_json')
      .eq('tx_hash', txHash)
      .eq('proposal_index', index)
      .single();

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const metaJson = (proposal.meta_json as Record<string, unknown>) ?? {};
    if (metaJson.ai_explanation) {
      return NextResponse.json({ explanation: metaJson.ai_explanation, cached: true });
    }

    const { data: votingSummary } = await supabase
      .from('proposal_voting_summary')
      .select('drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', index)
      .single();

    const { data: topRationales } = await supabase
      .from('vote_rationales')
      .select('rationale_text, ai_summary')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', index)
      .not('rationale_text', 'is', null)
      .limit(5);

    const rationaleContext = (topRationales ?? [])
      .map((r) => r.ai_summary || r.rationale_text?.slice(0, 300))
      .filter(Boolean)
      .join('\n- ');

    const voteContext = votingSummary
      ? `Votes so far: ${votingSummary.drep_yes_votes_cast ?? 0} Yes, ${votingSummary.drep_no_votes_cast ?? 0} No, ${votingSummary.drep_abstain_votes_cast ?? 0} Abstain.`
      : '';

    const withdrawalContext = proposal.withdrawal_amount
      ? `This proposal requests ${(Number(proposal.withdrawal_amount) / 1_000_000).toLocaleString()} ADA from the Cardano treasury.`
      : '';

    const prompt = `You are a governance analyst writing for DRepScore, a Cardano governance intelligence platform. Write a clear, informative explanation of this governance proposal for a crypto-literate audience.

PROPOSAL:
Title: ${proposal.title || 'Untitled'}
Type: ${proposal.proposal_type || 'Unknown'}
Abstract: ${proposal.abstract || 'No abstract available'}
${withdrawalContext}
${voteContext}

${rationaleContext ? `KEY ARGUMENTS FROM DREP RATIONALES:\n- ${rationaleContext}` : ''}

Write exactly 3 paragraphs:
1. **What it does** — Plain English explanation. No jargon. What would change if this passes?
2. **Why it matters** — Financial impact, governance precedent, broader implications for Cardano.
3. **Key considerations** — Arguments for and against, drawn from actual DRep rationales where available. Present both sides fairly.

Keep it under 250 words total. Be factual and balanced. Do not take a position. Output only the explanation text.`;

    const explanation = await generateText(prompt, { maxTokens: 600 });

    if (!explanation) {
      return NextResponse.json({ error: 'AI explanation unavailable' }, { status: 503 });
    }

    await supabase
      .from('proposals')
      .update({ meta_json: { ...metaJson, ai_explanation: explanation } })
      .eq('tx_hash', txHash)
      .eq('proposal_index', index);

    return NextResponse.json({ explanation, cached: false });
  } catch (error) {
    console.error('[Proposal Explainer] Error:', error);
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
