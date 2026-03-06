import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { computeTierProgress } from '@/lib/scoring/tiers';
import {
  computeAlignmentDrift,
  type Alignment6D,
  ALIGNMENT_DIMENSIONS,
} from '@/lib/alignment/drift';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/report-card?drepId=<id>&wallet=<optional>
 * Aggregated DRep report card — score, tier, trend, alignment match,
 * voting record, rationale quality. Personalized per citizen if wallet provided.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const drepId = searchParams.get('drepId');
  const wallet = searchParams.get('wallet');

  if (!drepId) {
    return NextResponse.json({ error: 'Required: drepId' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: drep } = await supabase
    .from('dreps')
    .select(
      'id, score, current_tier, score_momentum, engagement_quality, effective_participation_v3, reliability_v3, governance_identity, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, info, participation_rate, rationale_rate',
    )
    .eq('id', drepId)
    .single();

  if (!drep) {
    return NextResponse.json({ error: 'DRep not found' }, { status: 404 });
  }

  const tierProgress = computeTierProgress(drep.score ?? 0);

  const { data: history } = await supabase
    .from('drep_score_history')
    .select('snapshot_date, score')
    .eq('drep_id', drepId)
    .order('snapshot_date', { ascending: false })
    .limit(14);

  const { count: voteCount } = await supabase
    .from('drep_votes')
    .select('vote_tx_hash', { count: 'exact', head: true })
    .eq('drep_id', drepId);

  const { count: rationaleCount } = await supabase
    .from('vote_rationales')
    .select('vote_tx_hash', { count: 'exact', head: true })
    .eq('drep_id', drepId)
    .not('rationale_text', 'is', null);

  let alignmentMatch = null;
  if (wallet) {
    const { data: profile } = await supabase
      .from('user_governance_profiles')
      .select('alignment_scores')
      .eq('wallet_address', wallet)
      .single();

    if (profile?.alignment_scores && typeof profile.alignment_scores === 'object') {
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
      alignmentMatch = {
        matchScore: Math.max(0, 100 - drift.driftScore),
        driftScore: drift.driftScore,
        classification: drift.classification,
      };
    }
  }

  const info = (drep.info as Record<string, any> | null) ?? {};

  return NextResponse.json({
    drepId,
    score: drep.score,
    tier: drep.current_tier ?? tierProgress.currentTier,
    tierProgress,
    momentum: drep.score_momentum,
    name: info.name ?? info.ticker ?? null,
    isActive: info.isActive ?? true,
    delegatorCount: info.delegatorCount ?? 0,
    participationRate: drep.participation_rate != null ? Number(drep.participation_rate) : null,
    rationaleRate: drep.rationale_rate != null ? Number(drep.rationale_rate) : null,
    pillars: {
      engagementQuality: drep.engagement_quality,
      effectiveParticipation: drep.effective_participation_v3,
      reliability: drep.reliability_v3,
      governanceIdentity: drep.governance_identity,
    },
    alignment: {
      treasuryConservative: drep.alignment_treasury_conservative ?? null,
      treasuryGrowth: drep.alignment_treasury_growth ?? null,
      decentralization: drep.alignment_decentralization ?? null,
      security: drep.alignment_security ?? null,
      innovation: drep.alignment_innovation ?? null,
      transparency: drep.alignment_transparency ?? null,
    },
    votingRecord: {
      totalVotes: voteCount ?? 0,
      rationalesProvided: rationaleCount ?? 0,
      rationaleRate:
        voteCount && voteCount > 0 ? Math.round(((rationaleCount ?? 0) / voteCount) * 100) : 0,
    },
    scoreHistory: history ?? [],
    alignmentMatch,
  });
});
