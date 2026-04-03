import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getAllDReps } from '@/lib/data';
import type { EnrichedDRep } from '@/lib/koios';
import type { ApiContext } from '@/lib/api/handler';

function getScoreTier(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  return 'Low';
}

const VALID_SORT_FIELDS = ['score', 'name', 'participation', 'rationale', 'reliability'] as const;
const VALID_ORDERS = ['asc', 'desc'] as const;

async function handler(request: NextRequest, ctx: ApiContext) {
  const url = request.nextUrl;
  const search = url.searchParams.get('search')?.toLowerCase() || '';
  const sortField = url.searchParams.get('sort') || 'score';
  const order = url.searchParams.get('order') || 'desc';
  const activeOnly = url.searchParams.get('active_only') !== 'false';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);

  if (!(VALID_SORT_FIELDS as readonly string[]).includes(sortField)) {
    return apiError(
      'invalid_parameter',
      {
        param: 'sort',
        value: sortField,
        context: `Valid values: ${VALID_SORT_FIELDS.join(', ')}`,
      },
      { requestId: ctx.requestId },
    );
  }

  if (!(VALID_ORDERS as readonly string[]).includes(order)) {
    return apiError(
      'invalid_parameter',
      {
        param: 'order',
        value: order,
        context: "Valid values: 'asc', 'desc'",
      },
      { requestId: ctx.requestId },
    );
  }

  const { allDReps } = await getAllDReps();
  const pool = activeOnly ? allDReps.filter((d) => d.isActive) : allDReps;

  let filtered = pool;
  if (search) {
    filtered = filtered.filter(
      (d) =>
        d.name?.toLowerCase().includes(search) ||
        d.ticker?.toLowerCase().includes(search) ||
        d.handle?.toLowerCase().includes(search) ||
        d.drepId.toLowerCase().includes(search),
    );
  }

  const sortKeyMap: Record<string, (d: EnrichedDRep) => number | string> = {
    score: (d) => d.drepScore,
    name: (d) => (d.name || d.ticker || d.drepId).toLowerCase(),
    participation: (d) => d.effectiveParticipation,
    rationale: (d) => d.rationaleRate,
    reliability: (d) => d.reliabilityScore,
  };
  const sortFn = sortKeyMap[sortField];
  filtered.sort((a, b) => {
    const aVal = sortFn(a);
    const bVal = sortFn(b);
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return order === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const data = page.map((d) => ({
    drep_id: d.drepId,
    name: d.name,
    ticker: d.ticker,
    handle: d.handle || null,
    score: d.drepScore,
    score_tier: getScoreTier(d.drepScore),
    effective_participation: d.effectiveParticipation,
    rationale_rate: d.rationaleRate,
    reliability_score: d.reliabilityScore,
    profile_completeness: d.profileCompleteness,
    voting_power_lovelace: d.votingPowerLovelace,
    delegator_count: d.delegatorCount,
    is_active: d.isActive,
    last_vote_time: d.lastVoteTime,
  }));

  const latestUpdate = pool.reduce((max, d) => {
    const t = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
    return t > max ? t : max;
  }, 0);

  return apiSuccess(data, {
    requestId: ctx.requestId,
    dataCachedAt: latestUpdate ? new Date(latestUpdate) : undefined,
    cacheSeconds: 900,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    },
  });
}

export const GET = withApiHandler(handler);
export const dynamic = 'force-dynamic';
