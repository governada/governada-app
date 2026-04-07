import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import {
  fetchProposalVotingSummaries,
  indexProposalVotingSummaryTriBodies,
} from '@/lib/governance/proposalVotingSummary';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cached } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  const supabase = getSupabaseAdmin();

  type ProposalPayload = {
    proposals: {
      txHash: string;
      index: number;
      title: string | null;
      status: string;
      type: string | null;
      withdrawalAmount: number | null;
      treasuryTier: string | null;
      treasuryPct: number | null;
      expirationEpoch: number | null;
      proposedEpoch: number | null;
      relevantPrefs: string[];
      triBody: {
        drep: { yes: number; no: number; abstain: number };
        spo: { yes: number; no: number; abstain: number };
        cc: { yes: number; no: number; abstain: number };
      } | null;
      deliveryStatus: string | null;
      deliveryScore: number | null;
    }[];
    currentEpoch: number | null;
  };

  const payload = await cached<ProposalPayload>(`proposals:list:${limit}`, 60, async () => {
    const [proposalsResult, governanceStatsResult] = await Promise.all([
      supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, proposal_type, expired_epoch, ratified_epoch, enacted_epoch, dropped_epoch, expiration_epoch, proposed_epoch, withdrawal_amount, treasury_tier, block_time, relevant_prefs',
        )
        .order('proposed_epoch', { ascending: false })
        .limit(limit),
      supabase
        .from('governance_stats')
        .select('current_epoch, treasury_balance_lovelace')
        .eq('id', 1)
        .single(),
    ]);

    const { data, error } = proposalsResult;

    if (error) {
      logger.error('Failed to fetch proposals', {
        context: 'proposals',
        error: error.message,
        requestId,
      });
      throw new Error('Failed to fetch proposals');
    }

    const txHashes = [...new Set((data || []).map((proposal) => proposal.tx_hash))];
    const [votingSummaryRows, outcomesResult] = await Promise.all([
      fetchProposalVotingSummaries(
        supabase,
        txHashes,
        'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
      ),
      txHashes.length === 0
        ? Promise.resolve({
            data: [] as Array<{
              proposal_tx_hash: string;
              proposal_index: number;
              delivery_status: string | null;
              delivery_score: number | null;
            }>,
            error: null,
          })
        : supabase
            .from('proposal_outcomes')
            .select('proposal_tx_hash, proposal_index, delivery_status, delivery_score')
            .in('proposal_tx_hash', txHashes),
    ]);
    const triBodyMap = indexProposalVotingSummaryTriBodies(votingSummaryRows);

    const treasuryBalanceLovelace = governanceStatsResult.data?.treasury_balance_lovelace ?? null;
    const treasuryBalance = treasuryBalanceLovelace
      ? Number(treasuryBalanceLovelace) / 1_000_000
      : null;

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
      let status = 'Open';
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
        treasuryPct:
          withdrawalAmount && treasuryBalance ? withdrawalAmount / treasuryBalance : null,
        expirationEpoch: p.expiration_epoch ?? null,
        proposedEpoch: p.proposed_epoch ?? null,
        relevantPrefs: p.relevant_prefs ?? [],
        triBody,
        deliveryStatus: outcome?.deliveryStatus ?? null,
        deliveryScore: outcome?.deliveryScore ?? null,
      };
    });

    const currentEpoch = governanceStatsResult.data?.current_epoch ?? null;

    return { proposals, currentEpoch };
  });

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
});
