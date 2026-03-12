import { NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (_request, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('citizen_milestones')
      .select('milestone_key, milestone_label, achieved_at')
      .eq('user_id', userId!)
      .order('achieved_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
    }

    return NextResponse.json(
      {
        milestones: (data ?? []).map((m) => ({
          key: m.milestone_key,
          label: m.milestone_label,
          earnedAt: m.achieved_at,
        })),
      },
      { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120' } },
    );
  },
  { auth: 'required' },
);
