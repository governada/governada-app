import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getDRepById, getScoreHistory } from '@/lib/data';
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
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '90') || 90, 1), 365);

  const history = await getScoreHistory(drepId);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const filtered = history.filter((h) => h.date >= cutoffStr);

  const data = filtered.map((h) => ({
    date: h.date,
    score: h.score,
    effective_participation: h.effectiveParticipation,
    rationale_rate: h.rationaleRate,
    reliability_score: h.reliabilityScore,
    profile_completeness: h.profileCompleteness,
  }));

  return apiSuccess(data, {
    requestId: ctx.requestId,
    dataCachedAt: drep.updatedAt ? new Date(drep.updatedAt) : undefined,
    cacheSeconds: 3600,
  });
}

export const GET = withApiHandler(handler, { requiredTier: 'pro' });
export const dynamic = 'force-dynamic';
