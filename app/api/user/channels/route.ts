import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { ChannelConnectSchema, ChannelDeleteSchema } from '@/lib/api/schemas/user';
import { logger } from '@/lib/logger';

export const GET = withRouteHandler(
  async (request: NextRequest, { wallet }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('user_channels')
      .select('channel, channel_identifier, config, connected_at')
      .eq('user_wallet', wallet!);

    return NextResponse.json(data || []);
  },
  { auth: 'required' },
);

export const POST = withRouteHandler(
  async (request: NextRequest, { wallet }: RouteContext) => {
    const body = await request.json();
    const { channel, channelIdentifier, config } = ChannelConnectSchema.parse(body);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('user_channels').upsert(
      {
        user_wallet: wallet!,
        channel,
        channel_identifier: channelIdentifier,
        config: config || {},
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_wallet,channel' },
    );

    if (error) {
      logger.error('Failed to connect notification channel', {
        context: 'user/channels',
        error: error.message,
        channel,
      });
      return NextResponse.json({ error: 'Failed to connect channel' }, { status: 500 });
    }

    captureServerEvent('notification_channel_connected', { channel }, wallet!);
    return NextResponse.json({ ok: true });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);

export const DELETE = withRouteHandler(
  async (request: NextRequest, { wallet }: RouteContext) => {
    const body = await request.json();
    const { channel } = ChannelDeleteSchema.parse(body);

    const supabase = getSupabaseAdmin();
    await supabase.from('user_channels').delete().eq('user_wallet', wallet!).eq('channel', channel);

    captureServerEvent('notification_channel_disconnected', { channel }, wallet!);
    return NextResponse.json({ ok: true });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);
