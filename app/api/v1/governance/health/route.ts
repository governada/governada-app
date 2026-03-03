import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess } from '@/lib/api/response';
import { getAllDReps, getActualProposalCount } from '@/lib/data';
import type { ApiContext } from '@/lib/api/handler';

async function handler(request: NextRequest, ctx: ApiContext) {
  const [{ allDReps }, proposalCount] = await Promise.all([
    getAllDReps(),
    getActualProposalCount(),
  ]);

  const activeDReps = allDReps.filter((d) => d.isActive);
  const scores = allDReps.map((d) => d.drepScore).filter((s) => s > 0);
  const sorted = [...scores].sort((a, b) => a - b);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const median =
    sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;

  const participationRates = allDReps.map((d) => d.effectiveParticipation).filter((r) => r > 0);
  const rationaleRates = allDReps.map((d) => d.rationaleRate).filter((r) => r > 0);
  const totalVotesCast = allDReps.reduce((sum, d) => sum + d.totalVotes, 0);

  const data = {
    total_registered_dreps: allDReps.length,
    active_dreps: activeDReps.length,
    total_proposals: proposalCount,
    average_score: scores.length > 0 ? Math.round((sum(scores) / scores.length) * 10) / 10 : 0,
    median_score: Math.round(median * 10) / 10,
    average_participation_rate:
      participationRates.length > 0
        ? Math.round((sum(participationRates) / participationRates.length) * 1000) / 1000
        : 0,
    average_rationale_rate:
      rationaleRates.length > 0
        ? Math.round((sum(rationaleRates) / rationaleRates.length) * 1000) / 1000
        : 0,
    total_votes_cast: totalVotesCast,
    score_distribution: {
      strong: scores.filter((s) => s >= 80).length,
      good: scores.filter((s) => s >= 60 && s < 80).length,
      low: scores.filter((s) => s < 60).length,
    },
  };

  const latestUpdate = allDReps.reduce((max, d) => {
    const t = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
    return t > max ? t : max;
  }, 0);

  return apiSuccess(data, {
    requestId: ctx.requestId,
    dataCachedAt: latestUpdate ? new Date(latestUpdate) : undefined,
    cacheSeconds: 3600,
  });
}

export const GET = withApiHandler(handler);
export const dynamic = 'force-dynamic';
