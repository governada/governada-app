import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SupabaseUser, SupabaseUserUpdate } from '@/types/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('users').select('*').eq('id', userId!).single();

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousVisitAt = data.last_visit_at || null;

    await supabase
      .from('users')
      .update({ last_visit_at: new Date().toISOString() })
      .eq('id', userId!);

    return NextResponse.json({
      ...data,
      previousVisitAt,
    } as SupabaseUser & { previousVisitAt: string | null });
  },
  { auth: 'required' },
);

export const PATCH = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const updates: SupabaseUserUpdate = await request.json();

    const allowedFields: (keyof SupabaseUserUpdate)[] = [
      'prefs',
      'watchlist',
      'push_subscriptions',
      'display_name',
      'digest_frequency',
    ];

    const sanitizedUpdates: Record<string, unknown> = { last_active: new Date().toISOString() };
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .update(sanitizedUpdates)
      .eq('id', userId!)
      .select()
      .single();

    if (error) {
      logger.error('User update error', { context: 'user', error: error?.message });
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json(data as SupabaseUser);
  },
  { auth: 'required' },
);
