import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  const supabase = getSupabaseAdmin();

  const [proposalsResult, votingSummaryResult, treasuryResult, epochResult, outcomesResult] =
    await Promise.all([
      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, expired_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expiration_epoch, proposed_epoch, withdrawal_amount, treasury_tier, block_time, relevant_prefs',
        )
        .order('proposed_epoch', { ascending: false })
        .limit(limit),
      supabase
        .from('proposal_voting_summary')
        .select(
          'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
        ),
      supabase
        .from('treasury_balance')
        .select('balance_ada')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
      supabase
        .from('proposal_outcomes')
        .select('proposal_tx_hash, proposal_index, delivery_status, delivery_score'),
    ]);

  const { data, error } = proposalsResult;

  if (error) {
    logger.error('Failed to fetch proposals', {
      context: 'proposals',
      error: error.message,
      requestId,
    });
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }

  // Build tri-body vote lookup
  const triBodyMap = new Map<
    string,
    {
      drep: { yes: number; no: number; abstain: number };
      spo: { yes: number; no: number; abstain: number };
      cc: { yes: number; no: number; abstain: number };
    }
  >();
  if (votingSummaryResult.data) {
    for (const s of votingSummaryResult.data) {
      triBodyMap.set(`${s.proposal_tx_hash}-${s.proposal_index}`, {
        drep: {
          yes: s.drep_yes_votes_cast || 0,
          no: s.drep_no_votes_cast || 0,
          abstain: s.drep_abstain_votes_cast || 0,
        },
        spo: {
          yes: s.pool_yes_votes_cast || 0,
          no: s.pool_no_votes_cast || 0,
          abstain: s.pool_abstain_votes_cast || 0,
        },
        cc: {
          yes: s.committee_yes_votes_cast || 0,
          no: s.committee_no_votes_cast || 0,
          abstain: s.committee_abstain_votes_cast || 0,
        },
      });
    }
  }

  const treasuryBalance = treasuryResult.data?.balance_ada ?? null;

  // Build outcome lookup for delivery status badges
  const outcomeMap = new Map<string, { deliveryStatus: string; deliveryScore: number | null }>();
  if (outcomesResult.data) {
    for (const o of outcomesResult.data) {
      outcomeMap.set(`${o.proposal_tx_hash}-${o.proposal_index}`, {
        deliveryStatus: o.delivery_status,
        deliveryScore: o.delivery_score,
      });
    }
  }

  const proposals = (data || []).map((p) => {
    let status = 'active';
    if (p.enacted_epoch) status = 'enacted';
    else if (p.ratified_epoch) status = 'ratified';
    else if (p.expired_epoch) status = 'expired';
    else if (p.dropped_epoch) status = 'dropped';

    const key = `${p.tx_hash}-${p.proposal_index}`;
    const triBody = triBodyMap.get(key) ?? null;
    const withdrawalAmount = p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null;
    const outcome = outcomeMap.get(key);

    return {
      txHash: p.tx_hash,
      index: p.proposal_index,
      title: p.title,
      status,
      type: p.proposal_type,
      withdrawalAmount,
      treasuryTier: p.treasury_tier ?? null,
      treasuryPct: withdrawalAmount && treasuryBalance ? withdrawalAmount / treasuryBalance : null,
      expirationEpoch: p.expiration_epoch ?? null,
      proposedEpoch: p.proposed_epoch ?? null,
      relevantPrefs: p.relevant_prefs ?? [],
      triBody,
      deliveryStatus: outcome?.deliveryStatus ?? null,
      deliveryScore: outcome?.deliveryScore ?? null,
    };
  });

  const currentEpoch = epochResult.data?.current_epoch ?? null;

  return NextResponse.json({ proposals, currentEpoch });
});
