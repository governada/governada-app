import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { TelegramConnectSchema } from '@/lib/api/schemas/user';

export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const body = await request.json();
    const { token } = TelegramConnectSchema.parse(body);

    const supabase = getSupabaseAdmin();

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

    await supabase.from('user_channels').upsert(
      {
        user_id: userId!,
        channel: 'telegram',
        channel_identifier: chatId,
        config: { chatId: config.chatId },
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,channel' },
    );

    const defaultEvents = [
      'score-change',
      'pending-proposals',
      'urgent-deadline',
      'critical-proposal-open',
    ];
    for (const eventType of defaultEvents) {
      await supabase.from('notification_preferences').upsert(
        {
          user_id: userId!,
          channel: 'telegram',
          event_type: eventType,
          enabled: true,
        },
        { onConflict: 'user_id,channel,event_type' },
      );
    }

    captureServerEvent('telegram_connected', { chat_id: chatId }, wallet!);

    await supabase
      .from('user_channels')
      .delete()
      .eq('channel', 'telegram_pending')
      .eq('channel_identifier', chatId);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: "✅ <b>Wallet Connected!</b>\n\nYour Telegram is now linked to your Civica account. You'll receive governance alerts here.",
          parse_mode: 'HTML',
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  },
  { auth: 'required', rateLimit: { max: 5, window: 60 } },
);
