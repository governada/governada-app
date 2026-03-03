import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';

function getWallet(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const parsed = parseSessionToken(auth.slice(7));
  if (!parsed || isSessionExpired(parsed)) return null;
  return parsed.walletAddress;
}

export async function GET(request: NextRequest) {
  const wallet = getWallet(request);
  if (!wallet) return NextResponse.json([], { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('notification_preferences')
    .select('channel, event_type, enabled')
    .eq('user_wallet', wallet);

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const wallet = getWallet(request);
  if (!wallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channel, eventType, enabled } = await request.json();
  if (!channel || !eventType || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_wallet: wallet,
      channel,
      event_type: eventType,
      enabled,
    },
    { onConflict: 'user_wallet,channel,event_type' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  captureServerEvent(
    'notification_pref_toggled',
    { channel, event_type: eventType, enabled },
    wallet,
  );
  return NextResponse.json({ ok: true });
}
