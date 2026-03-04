import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { NotificationPrefSchema } from '@/lib/api/schemas/user';
import { logger } from '@/lib/logger';

export const GET = withRouteHandler(
  async (request: NextRequest, { wallet }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('notification_preferences')
      .select('channel, event_type, enabled')
      .eq('user_wallet', wallet!);

    return NextResponse.json(data || []);
  },
  { auth: 'required' },
);

export const POST = withRouteHandler(
  async (request: NextRequest, { wallet }: RouteContext) => {
    const body = await request.json();
    const { channel, eventType, enabled } = NotificationPrefSchema.parse(body);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('notification_preferences').upsert(
      {
        user_wallet: wallet!,
        channel,
        event_type: eventType,
        enabled,
      },
      { onConflict: 'user_wallet,channel,event_type' },
    );

    if (error) {
      logger.error('Failed to update notification preference', {
        context: 'user/notification-prefs',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
    }

    captureServerEvent(
      'notification_pref_toggled',
      { channel, event_type: eventType, enabled },
      wallet!,
    );
    return NextResponse.json({ ok: true });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);
