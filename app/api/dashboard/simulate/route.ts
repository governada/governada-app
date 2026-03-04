import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { applyRationaleCurve } from '@/utils/scoring';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  const additionalVotes = parseInt(request.nextUrl.searchParams.get('votes') || '0');
  const additionalRationales = parseInt(request.nextUrl.searchParams.get('rationales') || '0');

  if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const [drepResult, proposalCountResult, allDrepsResult] = await Promise.all([
    supabase
      .from('dreps')
      .select(
        'score, info, participation_rate, rationale_rate, effective_participation, deliberation_modifier, reliability_score, profile_completeness',
      )
      .eq('id', drepId)
      .single(),
    supabase.from('proposals').select('id', { count: 'exact', head: true }),
    supabase
      .from('dreps')
      .select('score')
      .not('info->isActive', 'eq', false)
      .order('score', { ascending: false }),
  ]);

  const drep = drepResult.data;
  if (!drep) return NextResponse.json({ error: 'DRep not found' }, { status: 404 });

  const totalProposals = proposalCountResult.count || 1;
  const currentTotalVotes = drep.info?.totalVotes || 0;

  const simTotalVotes = currentTotalVotes + additionalVotes;
  const simParticipation = Math.min(100, Math.round((simTotalVotes / totalProposals) * 100));
  const simEffParticipation = Math.round(simParticipation * (drep.deliberation_modifier || 1));

  const currentVotesWithRationale = Math.round((drep.rationale_rate / 100) * currentTotalVotes);
  const simRationaleRaw =
    simTotalVotes > 0
      ? Math.round(((currentVotesWithRationale + additionalRationales) / simTotalVotes) * 100)
      : 0;
  const simRationaleCurved = applyRationaleCurve(simRationaleRaw);

  const currentCurvedRationale = applyRationaleCurve(drep.rationale_rate);
  const currentScore = Math.round(
    drep.effective_participation * 0.3 +
      currentCurvedRationale * 0.35 +
      drep.reliability_score * 0.2 +
      drep.profile_completeness * 0.15,
  );

  const simScore = Math.round(
    simEffParticipation * 0.3 +
      simRationaleCurved * 0.35 +
      drep.reliability_score * 0.2 +
      drep.profile_completeness * 0.15,
  );

  const allScores = (allDrepsResult.data || []).map((d: any) => d.score);
  const currentRank = allScores.filter((s: number) => s > drep.score).length + 1;
  const simRank = allScores.filter((s: number) => s > simScore).length + 1;

  return NextResponse.json({
    current: {
      score: currentScore,
      participation: drep.effective_participation,
      rationale: currentCurvedRationale,
      reliability: drep.reliability_score,
      profile: drep.profile_completeness,
      rank: currentRank,
    },
    simulated: {
      score: Math.min(100, simScore),
      participation: simEffParticipation,
      rationale: simRationaleCurved,
      reliability: drep.reliability_score,
      profile: drep.profile_completeness,
      rank: simRank,
    },
    pendingProposalCount: additionalVotes,
  });
});
