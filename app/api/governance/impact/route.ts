import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import {
  simulateScoreImpact,
  type CurrentScoreState,
  type SimulatedAction,
} from '@/lib/scoring/impactSimulator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/impact?type=drep|spo&id=entityId&action=vote_yes&importance=2
 * Simulates score impact from hypothetical actions.
 *
 * Query params:
 *   type: 'drep' | 'spo'
 *   id: entityId
 *   action: comma-separated actions (vote_yes,provide_rationale)
 *   importance: proposal importance weight (default 1)
 *   closeMargin: 'true' if the proposal is close-margin
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('type') as 'drep' | 'spo';
  const entityId = searchParams.get('id');
  const actionsParam = searchParams.get('action') ?? 'vote_yes';
  const importance = parseFloat(searchParams.get('importance') ?? '1');
  const closeMargin = searchParams.get('closeMargin') === 'true';

  if (!entityType || !entityId || !['drep', 'spo'].includes(entityType)) {
    return NextResponse.json({ error: 'Required: type=drep|spo, id=entityId' }, { status: 400 });
  }

  const supabase = createClient();
  let currentState: CurrentScoreState;

  if (entityType === 'drep') {
    const { data: drep } = await supabase
      .from('dreps')
      .select(
        'score, engagement_quality, effective_participation_v3, reliability_v3, governance_identity',
      )
      .eq('id', entityId)
      .single();

    if (!drep) return NextResponse.json({ error: 'DRep not found' }, { status: 404 });

    const { count: voteCount } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash', { count: 'exact', head: true })
      .eq('drep_id', entityId);

    const { count: proposalCount } = await supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true });

    currentState = {
      composite: drep.score ?? 0,
      participationPct: drep.effective_participation_v3 ?? 0,
      consistencyPct: 0,
      reliabilityPct: drep.reliability_v3 ?? 0,
      governanceIdentityPct: drep.governance_identity ?? 0,
      engagementQualityPct: drep.engagement_quality ?? 0,
      effectiveParticipationPct: drep.effective_participation_v3 ?? 0,
      voteCount: voteCount ?? 0,
      totalProposals: proposalCount ?? 1,
    };
  } else {
    const { data: pool } = await supabase
      .from('pools')
      .select(
        'governance_score, participation_pct, consistency_pct, reliability_pct, governance_identity_pct, vote_count',
      )
      .eq('pool_id', entityId)
      .single();

    if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });

    const { count: proposalCount } = await supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true });

    currentState = {
      composite: pool.governance_score ?? 0,
      participationPct: pool.participation_pct ?? 0,
      consistencyPct: pool.consistency_pct ?? 0,
      reliabilityPct: pool.reliability_pct ?? 0,
      governanceIdentityPct: pool.governance_identity_pct ?? 0,
      voteCount: pool.vote_count ?? 0,
      totalProposals: proposalCount ?? 1,
    };
  }

  const actions: SimulatedAction[] = actionsParam.split(',').map((a) => ({
    type: a.trim() as SimulatedAction['type'],
    proposalImportance: importance,
    isCloseMargin: closeMargin,
  }));

  const result = simulateScoreImpact(entityType, currentState, actions);

  return NextResponse.json({
    entityType,
    entityId,
    ...result,
  });
});
