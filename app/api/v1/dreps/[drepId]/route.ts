import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getDRepById } from '@/lib/data';
import type { ApiContext } from '@/lib/api/handler';

function getScoreTier(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  return 'Low';
}

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

  const data = {
    drep_id: drep.drepId,
    drep_hash: drep.drepHash,
    name: drep.name,
    ticker: drep.ticker,
    handle: drep.handle || null,
    description: drep.description,
    score: drep.drepScore,
    score_tier: getScoreTier(drep.drepScore),
    score_breakdown: {
      rationale_quality: {
        raw: drep.rationaleRate,
        weighted: Math.round(drep.rationaleRate * 35 * 100) / 100,
        weight: 0.35,
      },
      effective_participation: {
        raw: drep.effectiveParticipation,
        weighted: Math.round(drep.effectiveParticipation * 30 * 100) / 100,
        weight: 0.3,
      },
      reliability: {
        raw: drep.reliabilityScore,
        weighted: Math.round(drep.reliabilityScore * 20 * 100) / 100,
        weight: 0.2,
      },
      profile_completeness: {
        raw: drep.profileCompleteness,
        weighted: Math.round(drep.profileCompleteness * 15 * 100) / 100,
        weight: 0.15,
      },
    },
    alignment: {
      treasury_conservative: drep.alignmentTreasuryConservative,
      treasury_growth: drep.alignmentTreasuryGrowth,
      decentralization: drep.alignmentDecentralization,
      security: drep.alignmentSecurity,
      innovation: drep.alignmentInnovation,
      transparency: drep.alignmentTransparency,
    },
    voting_power_lovelace: drep.votingPowerLovelace,
    delegator_count: drep.delegatorCount,
    total_votes: drep.totalVotes,
    vote_distribution: {
      yes: drep.yesVotes,
      no: drep.noVotes,
      abstain: drep.abstainVotes,
    },
    size_tier: drep.sizeTier,
    is_active: drep.isActive,
    anchor_url: drep.anchorUrl,
    metadata_hash_verified: drep.metadataHashVerified,
    last_vote_time: drep.lastVoteTime,
    updated_at: drep.updatedAt,
  };

  return apiSuccess(data, {
    requestId: ctx.requestId,
    dataCachedAt: drep.updatedAt ? new Date(drep.updatedAt) : undefined,
    cacheSeconds: 900,
  });
}

export const GET = withApiHandler(handler);
export const dynamic = 'force-dynamic';
