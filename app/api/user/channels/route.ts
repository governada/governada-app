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
    .from('user_channels')
    .select('channel, channel_identifier, config, connected_at')
    .eq('user_wallet', wallet);

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const wallet = getWallet(request);
  if (!wallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channel, channelIdentifier, config } = await request.json();
  if (!channel || !channelIdentifier) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('user_channels').upsert(
    {
      user_wallet: wallet,
      channel,
      channel_identifier: channelIdentifier,
      config: config || {},
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_wallet,channel' },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  captureServerEvent('notification_channel_connected', { channel }, wallet);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const wallet = getWallet(request);
  if (!wallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channel } = await request.json();
  if (!channel) return NextResponse.json({ error: 'Missing channel' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  await supabase.from('user_channels').delete().eq('user_wallet', wallet).eq('channel', channel);

  captureServerEvent('notification_channel_disconnected', { channel }, wallet);
  return NextResponse.json({ ok: true });
}
