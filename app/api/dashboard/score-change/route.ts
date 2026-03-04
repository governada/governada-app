import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: history } = await supabase
    .from('drep_score_history')
    .select('score, recorded_at')
    .eq('drep_id', drepId)
    .order('recorded_at', { ascending: false })
    .limit(14);

  if (!history || history.length < 2) {
    return NextResponse.json({ delta: 0 });
  }

  const currentScore = history[0].score;
  const weekAgo = history.length >= 7 ? history[6] : history[history.length - 1];
  const previousScore = weekAgo.score;
  const delta = currentScore - previousScore;

  captureServerEvent('score_change_api_served', {
    drep_id: drepId,
    delta,
    has_significant_change: Math.abs(delta) >= 3,
  });

  return NextResponse.json({
    currentScore,
    previousScore,
    delta,
    date: weekAgo.recorded_at,
  });
});
