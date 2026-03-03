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
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .maybeSingle();

  if (error) {
    return apiError('internal_error', {}, { requestId: ctx.requestId });
  }

  if (!data) {
    return apiError(
      'proposal_not_found',
      { value: `${txHash}#${proposalIndex}` },
      { requestId: ctx.requestId },
    );
  }

  const status = data.enacted_epoch
    ? 'enacted'
    : data.ratified_epoch
      ? 'ratified'
      : data.expired_epoch
        ? 'expired'
        : data.dropped_epoch
          ? 'dropped'
          : 'active';

  const proposal = {
    tx_hash: data.tx_hash,
    proposal_index: data.proposal_index,
    title: data.title,
    abstract: data.abstract,
    ai_summary: data.ai_summary,
    proposal_type: data.proposal_type,
    status,
    withdrawal_amount: data.withdrawal_amount,
    treasury_tier: data.treasury_tier,
    proposed_epoch: data.proposed_epoch,
    block_time: data.block_time,
    metadata_url: data.metadata_url,
    return_address: data.return_address,
    lifecycle: {
      ratified_epoch: data.ratified_epoch,
      enacted_epoch: data.enacted_epoch,
      dropped_epoch: data.dropped_epoch,
      expired_epoch: data.expired_epoch,
      expiration_epoch: data.expiration_epoch,
    },
  };

  return apiSuccess(proposal, {
    requestId: ctx.requestId,
    cacheSeconds: 300,
  });
}

export const GET = withApiHandler(handler as any);
export const dynamic = 'force-dynamic';
