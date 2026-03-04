import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/epoch-summary?wallet=<address>&epoch=<epochNo>
 * Returns personalized epoch summary for a citizen.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  const epochParam = searchParams.get('epoch');

  if (!wallet) {
    return NextResponse.json({ error: 'Required: wallet' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  let epochNo: number;
  if (epochParam) {
    epochNo = parseInt(epochParam, 10);
  } else {
    const { data: stats } = await supabase
      .from('governance_stats')
      .select('current_epoch')
      .eq('id', 1)
      .single();
    epochNo = (stats?.current_epoch ?? 1) - 1;
  }

  const { data: existing } = await supabase
    .from('citizen_epoch_summaries')
    .select('*')
    .eq('user_id', wallet)
    .eq('epoch_no', epochNo)
    .single();

  if (existing) {
    return NextResponse.json(existing);
  }

  const { data: user } = await supabase
    .from('users')
    .select('wallet_address, claimed_drep_id')
    .eq('wallet_address', wallet)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const drepId = user.claimed_drep_id;
  let drepVotesCast = 0;
  let drepScore: number | null = null;
  let drepTier: string | null = null;

  if (drepId) {
    const { count } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash', { count: 'exact', head: true })
      .eq('drep_id', drepId)
      .eq('epoch_no', epochNo);
    drepVotesCast = count ?? 0;

    const { data: snapshot } = await supabase
      .from('drep_score_history')
      .select('score')
      .eq('drep_id', drepId)
      .eq('epoch_no', epochNo)
      .single();
    drepScore = snapshot?.score ?? null;

    const { data: drep } = await supabase
      .from('dreps')
      .select('current_tier')
      .eq('id', drepId)
      .single();
    drepTier = drep?.current_tier ?? null;
  }

  const { data: recap } = await supabase
    .from('epoch_recaps')
    .select('proposals_submitted, proposals_ratified, treasury_withdrawn_ada')
    .eq('epoch', epochNo)
    .single();

  const summary = {
    user_id: wallet,
    epoch_no: epochNo,
    delegated_drep_id: drepId,
    drep_votes_cast: drepVotesCast,
    drep_score_at_epoch: drepScore,
    drep_tier_at_epoch: drepTier,
    proposals_voted_on: recap?.proposals_submitted ?? 0,
    treasury_allocated_lovelace: recap?.treasury_withdrawn_ada
      ? Math.round(recap.treasury_withdrawn_ada * 1_000_000)
      : 0,
    summary_json: {
      proposalsSubmitted: recap?.proposals_submitted ?? 0,
      proposalsRatified: recap?.proposals_ratified ?? 0,
    },
  };

  // Cache the computed summary for future requests
  await supabase
    .from('citizen_epoch_summaries')
    .upsert(summary, { onConflict: 'user_id,epoch_no' })
    .then(({ error }) => {
      if (error) {
        console.warn('[epoch-summary] Failed to cache summary', error.message);
      }
    });

  return NextResponse.json(summary);
});
