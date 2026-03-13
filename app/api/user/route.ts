import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SupabaseUser, SupabaseUserUpdate } from '@/types/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { isValidDepth, getTunerEvents, getTunerDigestFrequency } from '@/lib/governanceTuner';
import { EVENT_REGISTRY } from '@/lib/notificationRegistry';

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
      'governance_depth',
      'notification_preferences',
    ];

    const sanitizedUpdates: Record<string, unknown> = { last_active: new Date().toISOString() };
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    // When governance_depth is set, validate and compute derived notification settings
    if (updates.governance_depth !== undefined) {
      if (!isValidDepth(updates.governance_depth)) {
        return NextResponse.json({ error: 'Invalid governance_depth value' }, { status: 400 });
      }

      const depth = updates.governance_depth;
      const enabledEvents = getTunerEvents(depth);
      const enabledSet = new Set(enabledEvents);

      // Build notification_preferences: true for enabled events, false for the rest
      const allUserFacingKeys = EVENT_REGISTRY.filter(
        (e) => e.key !== 'profile-view' && e.key !== 'api-health-alert',
      ).map((e) => e.key);

      const notificationPreferences: Record<string, boolean> = {};
      for (const key of allUserFacingKeys) {
        notificationPreferences[key] = enabledSet.has(key);
      }

      sanitizedUpdates.notification_preferences = notificationPreferences;
      sanitizedUpdates.digest_frequency = getTunerDigestFrequency(depth);
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
