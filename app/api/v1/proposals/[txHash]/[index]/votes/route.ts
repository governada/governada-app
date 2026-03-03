import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ApiContext } from '@/lib/api/handler';

async function handler(
  request: NextRequest,
  ctx: ApiContext & { params: Promise<{ txHash: string; index: string }> },
) {
  const { txHash, index } = await ctx.params;
  const proposalIndex = parseInt(index, 10);

  if (!txHash || isNaN(proposalIndex)) {
    return apiError(
      'invalid_proposal_id',
      { value: `${txHash}-${index}` },
      { requestId: ctx.requestId },
    );
  }

  const supabase = getSupabaseAdmin();

  const [proposalResult, summaryResult, drepResult, spoResult, ccResult] = await Promise.all([
    supabase
      .from('proposals')
      .select('tx_hash')
      .eq('tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .maybeSingle(),
    supabase
      .from('proposal_voting_summary')
      .select(
        'drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
      )
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .maybeSingle(),
    supabase
      .from('drep_votes')
      .select('drep_id, vote, block_time, epoch_no')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .order('block_time', { ascending: false }),
    supabase
      .from('spo_votes')
      .select('pool_id, vote, block_time')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .order('block_time', { ascending: false }),
    supabase
      .from('cc_votes')
      .select('cc_hot_id, vote, block_time')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .order('block_time', { ascending: false }),
  ]);

  if (!proposalResult.data) {
    return apiError(
      'proposal_not_found',
      { value: `${txHash}#${proposalIndex}` },
      { requestId: ctx.requestId },
    );
  }

  const s = summaryResult.data;
  const summary = s
    ? {
        drep_yes: s.drep_yes_votes_cast || 0,
        drep_no: s.drep_no_votes_cast || 0,
        drep_abstain: s.drep_abstain_votes_cast || 0,
        spo_yes: s.pool_yes_votes_cast || 0,
        spo_no: s.pool_no_votes_cast || 0,
        spo_abstain: s.pool_abstain_votes_cast || 0,
        cc_yes: s.committee_yes_votes_cast || 0,
        cc_no: s.committee_no_votes_cast || 0,
        cc_abstain: s.committee_abstain_votes_cast || 0,
      }
    : null;

  const drepVotes = (drepResult.data || []).map((v) => ({
    drep_id: v.drep_id,
    vote: v.vote,
    block_time: v.block_time,
    epoch: v.epoch_no,
  }));

  const spoVotes = (spoResult.data || []).map((v) => ({
    pool_id: v.pool_id,
    vote: v.vote,
    block_time: v.block_time,
  }));

  const ccVotes = (ccResult.data || []).map((v) => ({
    cc_hot_id: v.cc_hot_id,
    vote: v.vote,
    block_time: v.block_time,
  }));

  return apiSuccess(
    {
      summary,
      drep_votes: drepVotes,
      spo_votes: spoVotes,
      cc_votes: ccVotes,
    },
    {
      requestId: ctx.requestId,
      cacheSeconds: 300,
    },
  );
}

export const GET = withApiHandler(handler as any);
export const dynamic = 'force-dynamic';
