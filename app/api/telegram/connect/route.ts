import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';

/**
 * POST: Complete Telegram connect flow
 * Called from profile page when user visits with telegram_connect token
 */
export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = parseSessionToken(auth.slice(7));
    if (!parsed || isSessionExpired(parsed)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Find the pending connection
    const { data: pending } = await supabase
      .from('user_channels')
      .select('*')
      .eq('channel', 'telegram_pending')
      .single();

    if (!pending) {
      return NextResponse.json({ error: 'No pending connection found' }, { status: 404 });
    }

    const config = pending.config as { token: string; chatId: number };
    if (config.token !== token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const chatId = String(config.chatId);
    const wallet = parsed.walletAddress;

    // Create the actual connection
    await supabase.from('user_channels').upsert(
      {
        user_wallet: wallet,
        channel: 'telegram',
        channel_identifier: chatId,
        config: { chatId: config.chatId },
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_wallet,channel' },
    );

    // Enable default notification preferences
    const defaultEvents = [
      'score-change',
      'pending-proposals',
      'urgent-deadline',
      'critical-proposal-open',
    ];
    for (const eventType of defaultEvents) {
      await supabase.from('notification_preferences').upsert(
        {
          user_wallet: wallet,
          channel: 'telegram',
          event_type: eventType,
          enabled: true,
        },
        { onConflict: 'user_wallet,channel,event_type' },
      );
    }

    captureServerEvent('telegram_connected', { chat_id: chatId }, wallet);

    // Clean up pending
    await supabase
      .from('user_channels')
      .delete()
      .eq('channel', 'telegram_pending')
      .eq('channel_identifier', chatId);

    // Notify user on Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: "✅ <b>Wallet Connected!</b>\n\nYour Telegram is now linked to your DRepScore account. You'll receive governance alerts here.",
          parse_mode: 'HTML',
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Telegram Connect] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
