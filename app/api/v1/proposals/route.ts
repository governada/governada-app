import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import {
  fetchProposalListPage,
  type ProposalListSort,
  type ProposalListStatus,
} from '@/lib/governance/proposalList';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ApiContext } from '@/lib/api/handler';

const VALID_STATUSES = ['active', 'ratified', 'enacted', 'expired', 'dropped', 'all'] as const;
const VALID_SORTS = ['newest', 'most_votes', 'most_contested'] as const;

async function handler(request: NextRequest, ctx: ApiContext) {
  const url = request.nextUrl;
  const status = url.searchParams.get('status') || 'all';
  const type = url.searchParams.get('type') || null;
  const sort = url.searchParams.get('sort') || 'newest';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);

  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return apiError(
      'invalid_parameter',
      {
        param: 'status',
        value: status,
        context: `Valid values: ${VALID_STATUSES.join(', ')}`,
      },
      { requestId: ctx.requestId },
    );
  }

  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    return apiError(
      'invalid_parameter',
      {
        param: 'sort',
        value: sort,
        context: `Valid values: ${VALID_SORTS.join(', ')}`,
      },
      { requestId: ctx.requestId },
    );
  }

  const supabase = getSupabaseAdmin();
  const { proposals: page, total } = await fetchProposalListPage(supabase, {
    status: status as ProposalListStatus,
    type,
    sort: sort as ProposalListSort,
    limit,
    offset,
  });

  const data = page.map((p) => ({
    tx_hash: p.txHash,
    proposal_index: p.proposalIndex,
    title: p.title,
    abstract: p.abstract,
    ai_summary: p.aiSummary,
    proposal_type: p.proposalType,
    status: p.status,
    withdrawal_amount: p.withdrawalAmount,
    treasury_tier: p.treasuryTier,
    proposed_epoch: p.proposedEpoch,
    block_time: p.blockTime,
    votes: {
      yes: p.yesCount,
      no: p.noCount,
      abstain: p.abstainCount,
      total: p.totalVotes,
    },
    lifecycle: {
      ratified_epoch: p.ratifiedEpoch,
      enacted_epoch: p.enactedEpoch,
      dropped_epoch: p.droppedEpoch,
      expired_epoch: p.expiredEpoch,
      expiration_epoch: p.expirationEpoch,
    },
  }));

  return apiSuccess(data, {
    requestId: ctx.requestId,
    cacheSeconds: 900,
    pagination: { total, limit, offset, has_more: offset + limit < total },
  });
}

export const GET = withApiHandler(handler);
export const dynamic = 'force-dynamic';
