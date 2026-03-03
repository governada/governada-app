import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('vote_explanations')
    .select('*')
    .eq('drep_id', drepId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Explanations GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch explanations' }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;

  try {
    const body = await request.json();
    const { sessionToken, proposalTxHash, proposalIndex, explanationText, aiAssisted } = body;

    if (!sessionToken || !proposalTxHash || proposalIndex == null || !explanationText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsed = parseSessionToken(sessionToken);
    if (!parsed || isSessionExpired(parsed)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: user } = await supabase
      .from('users')
      .select('claimed_drep_id')
      .eq('wallet_address', parsed.walletAddress)
      .single();

    if (!user || user.claimed_drep_id !== drepId) {
      return NextResponse.json({ error: 'Not authorized for this DRep' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('vote_explanations')
      .upsert(
        {
          drep_id: drepId,
          proposal_tx_hash: proposalTxHash,
          proposal_index: proposalIndex,
          explanation_text: explanationText,
          ai_assisted: aiAssisted || false,
        },
        { onConflict: 'drep_id,proposal_tx_hash,proposal_index' },
      )
      .select()
      .single();

    if (error) {
      console.error('[Explanations POST] Error:', error);
      return NextResponse.json({ error: 'Failed to save explanation' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[Explanations POST] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
