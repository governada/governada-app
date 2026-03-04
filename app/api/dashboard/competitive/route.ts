import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: allDreps, error } = await supabase
    .from('dreps')
    .select(
      'id, score, info, participation_rate, rationale_rate, reliability_score, profile_completeness, effective_participation, metadata',
    )
    .not('info->isActive', 'eq', false)
    .order('score', { ascending: false });

  if (error || !allDreps) {
    return NextResponse.json({ error: 'Failed to fetch DReps' }, { status: 500 });
  }

  const currentIndex = allDreps.findIndex((d: any) => d.id === drepId);
  if (currentIndex === -1) {
    return NextResponse.json({ error: 'DRep not found in rankings' }, { status: 404 });
  }

  const rank = currentIndex + 1;
  const totalActive = allDreps.length;
  const currentDrep = allDreps[currentIndex];

  const nearbyAbove = allDreps
    .slice(Math.max(0, currentIndex - 2), currentIndex)
    .map((d: any, i: number) => ({
      drepId: d.id,
      name: d.metadata?.givenName || d.id.slice(0, 16),
      score: d.score,
      rank: Math.max(0, currentIndex - 2) + i + 1,
    }));

  const nearbyBelow = allDreps
    .slice(currentIndex + 1, currentIndex + 3)
    .map((d: any, i: number) => ({
      drepId: d.id,
      name: d.metadata?.givenName || d.id.slice(0, 16),
      score: d.score,
      rank: currentIndex + 2 + i,
    }));

  const top10 = allDreps.slice(0, Math.min(10, allDreps.length));
  const top10Avg = {
    participation: Math.round(
      top10.reduce((s: number, d: any) => s + (d.effective_participation || 0), 0) / top10.length,
    ),
    rationale: Math.round(
      top10.reduce((s: number, d: any) => s + (d.rationale_rate || 0), 0) / top10.length,
    ),
    reliability: Math.round(
      top10.reduce((s: number, d: any) => s + (d.reliability_score || 0), 0) / top10.length,
    ),
    profile: Math.round(
      top10.reduce((s: number, d: any) => s + (d.profile_completeness || 0), 0) / top10.length,
    ),
  };

  const currentPillars = {
    participation: currentDrep.effective_participation || 0,
    rationale: currentDrep.rationale_rate || 0,
    reliability: currentDrep.reliability_score || 0,
    profile: currentDrep.profile_completeness || 0,
  };

  const gaps = [
    { pillar: 'Participation', gap: top10Avg.participation - currentPillars.participation },
    { pillar: 'Rationale', gap: top10Avg.rationale - currentPillars.rationale },
    { pillar: 'Reliability', gap: top10Avg.reliability - currentPillars.reliability },
    { pillar: 'Profile', gap: top10Avg.profile - currentPillars.profile },
  ]
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  const distanceToTop10 =
    rank > 10 && allDreps.length >= 10 ? allDreps[9].score - currentDrep.score : 0;

  return NextResponse.json({
    rank,
    totalActive,
    nearbyAbove,
    nearbyBelow,
    distanceToTop10,
    top10FocusArea: gaps[0] || null,
    top10Avg,
    currentPillars,
  });
});
