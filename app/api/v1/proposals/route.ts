import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getAllProposalsWithVoteSummary } from '@/lib/data';
import type { ApiContext } from '@/lib/api/handler';

const VALID_STATUSES = ['active', 'ratified', 'enacted', 'expired', 'dropped', 'all'] as const;
const VALID_SORTS = ['newest', 'most_votes', 'most_contested'] as const;

function getProposalStatus(p: any): string {
  if (p.enactedEpoch) return 'enacted';
  if (p.ratifiedEpoch) return 'ratified';
  if (p.expiredEpoch) return 'expired';
  if (p.droppedEpoch) return 'dropped';
  return 'active';
}

async function handler(request: NextRequest, ctx: ApiContext) {
  const url = request.nextUrl;
  const status = url.searchParams.get('status') || 'all';
  const type = url.searchParams.get('type') || null;
  const sort = url.searchParams.get('sort') || 'newest';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);

  if (!VALID_STATUSES.includes(status as any)) {
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

  if (!VALID_SORTS.includes(sort as any)) {
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

  const proposals = await getAllProposalsWithVoteSummary();

  let filtered = proposals.map((p) => ({ ...p, status: getProposalStatus(p) }));

  if (status !== 'all') {
    filtered = filtered.filter((p) => p.status === status);
  }

  if (type) {
    filtered = filtered.filter((p) => p.proposalType === type);
  }

  if (sort === 'most_votes') {
    filtered.sort((a, b) => b.totalVotes - a.totalVotes);
  } else if (sort === 'most_contested') {
    filtered.sort((a, b) => {
      const contestA = a.totalVotes > 0 ? Math.min(a.yesCount, a.noCount) / a.totalVotes : 0;
      const contestB = b.totalVotes > 0 ? Math.min(b.yesCount, b.noCount) / b.totalVotes : 0;
      return contestB - contestA;
    });
  }
  // 'newest' is default sort from the data layer (block_time DESC)

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

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
