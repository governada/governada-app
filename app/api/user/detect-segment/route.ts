import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { detectUserSegment } from '@/lib/walletDetection';
import { createClient } from '@/lib/supabase';
import { computeTier } from '@/lib/scoring/tiers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/detect-segment?stakeAddress=stake1...
 * Detects user segment (citizen, spo, drep, cc) from their stake address.
 * Also returns tier for DReps/SPOs for header personalization.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const stakeAddress = searchParams.get('stakeAddress');

  if (!stakeAddress) {
    return NextResponse.json({ error: 'Required: stakeAddress' }, { status: 400 });
  }

  const result = await detectUserSegment(stakeAddress);
  const supabase = createClient();

  // Check CC membership: match stake address against cc_members hot/cold credentials
  if (result.segment === 'citizen') {
    const { data: ccMatch } = await supabase
      .from('cc_members')
      .select('cc_hot_id')
      .or(`cc_hot_id.eq.${stakeAddress},cc_cold_id.eq.${stakeAddress}`)
      .limit(1);

    if (ccMatch && ccMatch.length > 0) {
      result.segment = 'cc';
    }
  }

  // Enrich with tier data for header personalization
  // For dual-role (DRep+SPO), use DRep tier since DRep is the primary segment
  let tier: string | null = null;

  if (result.drepId) {
    const { data: drep } = await supabase
      .from('dreps')
      .select('score')
      .eq('id', result.drepId)
      .single();
    if (drep?.score != null) {
      tier = computeTier(drep.score);
    }
  } else if (result.poolId) {
    const { data: pool } = await supabase
      .from('pools')
      .select('governance_score')
      .eq('pool_id', result.poolId)
      .single();
    if (pool?.governance_score != null) {
      tier = computeTier(pool.governance_score);
    }
  }

  return NextResponse.json({ ...result, tier });
});
