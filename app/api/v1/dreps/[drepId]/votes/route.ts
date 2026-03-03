import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import {
  getDRepById,
  getVotesByDRepId,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
} from '@/lib/data';
import type { ApiContext } from '@/lib/api/handler';

async function handler(request: NextRequest, ctx: ApiContext, params?: Record<string, string>) {
  const drepId = decodeURIComponent(params?.drepId || '');
  if (!drepId) {
    return apiError(
      'missing_parameter',
      { param: 'drepId', context: 'DRep ID is required in the URL path.' },
      { requestId: ctx.requestId },
    );
  }

  const drep = await getDRepById(drepId);
  if (!drep) {
    return apiError('drep_not_found', { value: drepId }, { requestId: ctx.requestId });
  }

  const url = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);
  const epochFilter = url.searchParams.get('epoch')
    ? parseInt(url.searchParams.get('epoch')!)
    : null;

  let votes = await getVotesByDRepId(drepId);

  if (epochFilter !== null && !isNaN(epochFilter)) {
    votes = votes.filter((v) => v.epoch_no === epochFilter);
  }

  const total = votes.length;
  const page = votes.slice(offset, offset + limit);

  // Enrich with proposal metadata and rationale
  const proposalIds = page.map((v) => ({ txHash: v.proposal_tx_hash, index: v.proposal_index }));
  const voteTxHashes = page.map((v) => v.vote_tx_hash);

  const [proposalMap, rationaleMap] = await Promise.all([
    getProposalsByIds(proposalIds),
    getRationalesByVoteTxHashes(voteTxHashes),
  ]);

  const data = page.map((v) => {
    const pKey = `${v.proposal_tx_hash}-${v.proposal_index}`;
    const proposal = proposalMap.get(pKey);
    const rationale = rationaleMap.get(v.vote_tx_hash);

    return {
      vote_tx_hash: v.vote_tx_hash,
      proposal_tx_hash: v.proposal_tx_hash,
      proposal_index: v.proposal_index,
      proposal_title: proposal?.title || null,
      proposal_type: proposal?.proposalType || null,
      vote: v.vote.toLowerCase(),
      epoch: v.epoch_no,
      block_time: v.block_time,
      rationale_text: rationale?.rationaleText || null,
      rationale_ai_summary: rationale?.rationaleAiSummary || null,
      rationale_hash_verified: rationale?.hashVerified ?? null,
      meta_url: v.meta_url,
    };
  });

  return apiSuccess(data, {
    requestId: ctx.requestId,
    cacheSeconds: 900,
    pagination: { total, limit, offset, has_more: offset + limit < total },
  });
}

export const GET = withApiHandler(handler, { requiredTier: 'pro' });
export const dynamic = 'force-dynamic';
