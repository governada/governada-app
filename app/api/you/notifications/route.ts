import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/**
 * GET /api/you/notifications — fetch the authenticated user's inbox notifications.
 * Query params:
 *   - unread_only: "true" to filter to unread only
 *   - cursor: ISO timestamp for pagination (created_at < cursor)
 */
export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const url = request.nextUrl;
    const unreadOnly = url.searchParams.get('unread_only') === 'true';
    const cursor = url.searchParams.get('cursor');

    // Resolve userId → stake_address via user_wallets
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('stake_address')
      .eq('user_id', userId!)
      .limit(1)
      .maybeSingle();

    if (!wallet?.stake_address) {
      // Fallback: check users.wallet_address for legacy users
      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId!)
        .maybeSingle();

      if (!user?.wallet_address) {
        return NextResponse.json({ notifications: [], hasMore: false });
      }

      // For legacy users without user_wallets entry, we can't query
      // the notifications table since it requires stake_address.
      // Return empty until they re-authenticate (which creates the entry).
      return NextResponse.json({ notifications: [], hasMore: false });
    }

    let query = supabase
      .from('notifications')
      .select('id, title, body, type, action_url, metadata, read, created_at')
      .eq('user_stake_address', wallet.stake_address)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const hasMore = (data?.length ?? 0) > PAGE_SIZE;
    const notifications = (data ?? []).slice(0, PAGE_SIZE);

    // Also return unread count for badge
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_stake_address', wallet.stake_address)
      .eq('read', false);

    return NextResponse.json({
      notifications,
      hasMore,
      unreadCount: unreadCount ?? 0,
    });
  },
  { auth: 'required' },
);

/**
 * PATCH /api/you/notifications — mark notifications as read.
 * Body: { ids: string[] } or { markAllRead: true }
 */
export const PATCH = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    // Resolve userId → stake_address
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('stake_address')
      .eq('user_id', userId!)
      .limit(1)
      .maybeSingle();

    if (!wallet?.stake_address) {
      return NextResponse.json({ error: 'No wallet linked' }, { status: 400 });
    }

    if (body.markAllRead) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_stake_address', wallet.stake_address)
        .eq('read', false);
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      // Validate: only mark notifications belonging to this user
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_stake_address', wallet.stake_address)
        .in('id', body.ids.slice(0, 100));
    } else {
      return NextResponse.json({ error: 'Provide ids[] or markAllRead: true' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  },
  { auth: 'required' },
);
