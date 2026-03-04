import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.pathname.split('/api/dreps/')[1]?.split('/')[0];

  const supabase = createClient();
  const { data } = await supabase
    .from('drep_milestones')
    .select('milestone_key, achieved_at')
    .eq('drep_id', drepId)
    .order('achieved_at', { ascending: false });

  const milestones = (data || []).map((d: { milestone_key: string; achieved_at: string }) => ({
    milestoneKey: d.milestone_key,
    achievedAt: d.achieved_at,
  }));

  return NextResponse.json({ milestones });
});
