import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { shortenDRepId } from '@/utils/display';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function displayName(row: any): string {
  const info = row.info || {};
  return info.name || info.ticker || info.handle || shortenDRepId(row.id);
}

export const GET = withRouteHandler(async (request, { requestId }) => {
  const tier = request.nextUrl.searchParams.get('tier') || 'all';
  const limitParam = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  const limit = Math.min(50, Math.max(1, limitParam));
    const supabase = createClient();

    let query = supabase
      .from('dreps')
      .select(
        'id, score, size_tier, info, effective_participation, rationale_rate, reliability_score, profile_completeness',
      )
      .order('score', { ascending: false })
      .limit(limit);

    if (tier !== 'all') {
      query = query.eq('size_tier', tier);
    }

    const { data: topDreps, error } = await query;
    if (error) throw error;

    const leaderboard = (topDreps || []).map((d: any, i: number) => ({
      rank: i + 1,
      drepId: d.id,
      name: displayName(d),
      score: d.score ?? 0,
      sizeTier: d.size_tier,
      isActive: d.info?.isActive ?? false,
      participation: d.effective_participation ?? 0,
      rationale: d.rationale_rate ?? 0,
      reliability: d.reliability_score ?? 0,
    }));

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const { data: historyData } = await supabase
      .from('drep_score_history')
      .select('drep_id, score, recorded_at')
      .lte('recorded_at', sevenDaysAgo)
      .order('recorded_at', { ascending: false })
      .limit(2000);

    const oldScoreMap = new Map<string, number>();
    for (const h of historyData || []) {
      if (!oldScoreMap.has(h.drep_id)) {
        oldScoreMap.set(h.drep_id, h.score);
      }
    }

    const { data: currentDreps } = await supabase
      .from('dreps')
      .select('id, score, info')
      .gt('score', 0)
      .order('score', { ascending: false });

    const movers = (currentDreps || [])
      .map((d: any) => {
        const old = oldScoreMap.get(d.id);
        if (old === undefined) return null;
        return {
          drepId: d.id,
          name: displayName(d),
          currentScore: d.score,
          previousScore: old,
          delta: d.score - old,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null && m.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const gainers = movers.filter((m) => m.delta > 0).slice(0, 5);
    const losers = movers.filter((m) => m.delta < 0).slice(0, 5);

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    const { data: hallData } = await supabase
      .from('drep_score_history')
      .select('drep_id, score, recorded_at')
      .gte('recorded_at', ninetyDaysAgo)
      .gte('score', 80)
      .order('drep_id');

    const drepDayCounts = new Map<string, number>();
    for (const h of hallData || []) {
      drepDayCounts.set(h.drep_id, (drepDayCounts.get(h.drep_id) || 0) + 1);
    }

    const hallOfFameIds = [...drepDayCounts.entries()]
      .filter(([, count]) => count >= 60)
      .map(([id]) => id);

    let hallOfFame: { drepId: string; name: string; score: number; days: number }[] = [];
    if (hallOfFameIds.length > 0) {
      const { data: hofDreps } = await supabase
        .from('dreps')
        .select('id, score, info')
        .in('id', hallOfFameIds.slice(0, 20));

      hallOfFame = (hofDreps || [])
        .map((d: any) => ({
          drepId: d.id,
          name: displayName(d),
          score: d.score,
          days: drepDayCounts.get(d.id) || 0,
        }))
        .sort((a, b) => b.days - a.days);
    }

    captureServerEvent('leaderboard_api_served', {
      tier,
      limit,
      leaderboard_count: leaderboard.length,
      gainers_count: gainers.length,
      losers_count: losers.length,
      hall_of_fame_count: hallOfFame.length,
    });

    return NextResponse.json({
      leaderboard,
      weeklyMovers: { gainers, losers },
      hallOfFame,
    });
});
