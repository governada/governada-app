import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { computeTierProgress } from '@/lib/scoring/tiers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/tiers?type=drep|spo&id=entityId
 * Returns tier info, progress, and history for a DRep or SPO.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('type');
  const entityId = searchParams.get('id');

  if (!entityType || !entityId || !['drep', 'spo'].includes(entityType)) {
    return NextResponse.json({ error: 'Required: type=drep|spo, id=entityId' }, { status: 400 });
  }

  const supabase = createClient();

  let currentScore: number | null = null;
  let currentTier: string | null = null;

  if (entityType === 'drep') {
    const { data } = await supabase
      .from('dreps')
      .select('score, current_tier')
      .eq('id', entityId)
      .single();
    currentScore = data?.score ?? null;
    currentTier = data?.current_tier ?? null;
  } else {
    const { data } = await supabase
      .from('pools')
      .select('governance_score, current_tier')
      .eq('pool_id', entityId)
      .single();
    currentScore = data?.governance_score ?? null;
    currentTier = data?.current_tier ?? null;
  }

  if (currentScore === null) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  const progress = computeTierProgress(currentScore);

  const { data: history } = await supabase
    .from('tier_changes')
    .select('old_tier, new_tier, old_score, new_score, epoch_no, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    entityType,
    entityId,
    currentTier: currentTier ?? progress.currentTier,
    score: currentScore,
    progress,
    history: history ?? [],
  });
});
