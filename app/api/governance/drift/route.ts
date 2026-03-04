import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import {
  computeAlignmentDrift,
  type Alignment6D,
  ALIGNMENT_DIMENSIONS,
} from '@/lib/alignment/drift';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/drift?wallet=<walletAddress>
 * Returns current alignment drift between citizen and their delegated DRep.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'Required: wallet' }, { status: 400 });
  }

  const supabase = createClient();

  const [{ data: user }, { data: profile }] = await Promise.all([
    supabase
      .from('users')
      .select('wallet_address, claimed_drep_id')
      .eq('wallet_address', wallet)
      .single(),
    supabase
      .from('user_governance_profiles')
      .select('alignment_scores, confidence')
      .eq('wallet_address', wallet)
      .single(),
  ]);

  if (!user?.claimed_drep_id) {
    return NextResponse.json({
      hasDelegation: false,
      drift: null,
      message: 'No active DRep delegation found',
    });
  }

  if (!profile?.alignment_scores) {
    return NextResponse.json({
      hasDelegation: true,
      drepId: user.claimed_drep_id,
      drift: null,
      message: 'No governance profile computed yet (needs poll participation)',
    });
  }

  const { data: drep } = await supabase
    .from('dreps')
    .select(
      'id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .eq('id', user.claimed_drep_id)
    .single();

  if (!drep) {
    return NextResponse.json({
      hasDelegation: true,
      drepId: user.claimed_drep_id,
      drift: null,
      message: 'Delegated DRep not found in scoring data',
    });
  }

  const citizenAlignment: Alignment6D = {
    treasury_conservative: 50,
    treasury_growth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
  };
  const scores = profile.alignment_scores as Record<string, number>;
  for (const dim of ALIGNMENT_DIMENSIONS) {
    citizenAlignment[dim] = scores[dim] ?? 50;
  }

  const drepAlignment: Alignment6D = {
    treasury_conservative: drep.alignment_treasury_conservative ?? 50,
    treasury_growth: drep.alignment_treasury_growth ?? 50,
    decentralization: drep.alignment_decentralization ?? 50,
    security: drep.alignment_security ?? 50,
    innovation: drep.alignment_innovation ?? 50,
    transparency: drep.alignment_transparency ?? 50,
  };

  const drift = computeAlignmentDrift(citizenAlignment, drepAlignment);

  const { data: history } = await supabase
    .from('alignment_drift_records')
    .select('drift_score, drift_classification, alternative_dreps, epoch_no, created_at')
    .eq('user_id', wallet)
    .eq('drep_id', user.claimed_drep_id)
    .order('created_at', { ascending: false })
    .limit(10);

  const latestRecord = history?.[0];
  const alternatives =
    (latestRecord?.alternative_dreps as Array<{
      drep_id: string;
      match_score: number;
      governance_score: number;
    }>) ?? [];

  return NextResponse.json({
    hasDelegation: true,
    drepId: user.claimed_drep_id,
    drift: {
      score: drift.driftScore,
      classification: drift.classification,
      dimensions: drift.dimensionDrifts,
      worstDimension: drift.worstDimension,
    },
    alternatives,
    history: history ?? [],
    confidence: profile.confidence,
  });
});
