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
  const { data } = await supabase
    .from('governance_philosophy')
    .select('philosophy_text, updated_at')
    .eq('drep_id', drepId)
    .single();

  return NextResponse.json(data || { philosophy_text: null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  try {
    const { sessionToken, philosophyText } = await request.json();
    if (!sessionToken || !philosophyText)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const parsed = parseSessionToken(sessionToken);
    if (!parsed || isSessionExpired(parsed))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('claimed_drep_id')
      .eq('wallet_address', parsed.walletAddress)
      .single();

    if (!user || user.claimed_drep_id !== drepId)
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const { data, error } = await supabase
      .from('governance_philosophy')
      .upsert({ drep_id: drepId, philosophy_text: philosophyText }, { onConflict: 'drep_id' })
      .select()
      .single();

    if (error) {
      console.error('[Philosophy POST] Error:', error);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[Philosophy POST] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
