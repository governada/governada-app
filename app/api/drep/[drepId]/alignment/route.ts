/**
 * DRep Alignment API — Decision Engine Phase 1 (WS-9)
 *
 * POST /api/drep/[drepId]/alignment
 *
 * Orchestrates per-proposal alignment (WS-1), delegation simulation (WS-2),
 * and decomposed trust signals into a single viewer-specific response.
 *
 * Auth: optional. Authenticated users get alignment from DB profile.
 * Unauthenticated users POST their alignment scores in the request body.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { cached } from '@/lib/redis';
import { getDRepById, getVotesByDRepId, getDRepDelegationTrend } from '@/lib/data';
import type { AlignmentScores } from '@/lib/drepIdentity';
import {
  computeProposalAlignment,
  type VoteWithClassification,
  type VoteClassification,
  type AlignmentSummary,
} from '@/lib/matching/proposalAlignment';
import {
  computeDelegationSimulation,
  type DelegationSimulation,
} from '@/lib/matching/delegationSimulation';
import { getProposalOutcomesBatch } from '@/lib/proposalOutcomes';
import { getProposalsByIds } from '@/lib/data';
import { getProposalDisplayTitle } from '@/utils/display';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

/* ─── Types ───────────────────────────────────────────── */

export interface TrustSignal {
  key: 'participation' | 'rationale' | 'reliability' | 'delegation_trend' | 'profile_quality';
  label: string;
  value: number;
  status: 'strong' | 'moderate' | 'weak';
  detail?: string;
}

interface AlignmentResponse {
  alignment: AlignmentSummary | null;
  simulation: DelegationSimulation | null;
  comparison: null;
  trustSignals: TrustSignal[];
}

/* ─── Validation ──────────────────────────────────────── */

const AlignmentScoresSchema = z
  .object({
    treasuryConservative: z.number().min(0).max(100).nullable().optional(),
    treasuryGrowth: z.number().min(0).max(100).nullable().optional(),
    decentralization: z.number().min(0).max(100).nullable().optional(),
    security: z.number().min(0).max(100).nullable().optional(),
    innovation: z.number().min(0).max(100).nullable().optional(),
    transparency: z.number().min(0).max(100).nullable().optional(),
  })
  .optional();

const RequestBodySchema = z
  .object({
    userAlignment: AlignmentScoresSchema,
  })
  .optional();

/* ─── Trust Signal Computation ────────────────────────── */

interface DRepTrustData {
  effectiveParticipation: number;
  rationaleRate: number;
  reliabilityStreak: number;
  reliabilityRecency: number;
  profileCompleteness: number;
  metadataHashVerified: boolean | null;
  delegationTrend: { epoch: number; votingPowerAda: number }[];
}

function computeTrustSignals(data: DRepTrustData): TrustSignal[] {
  const signals: TrustSignal[] = [];

  // Participation
  const participation = data.effectiveParticipation;
  signals.push({
    key: 'participation',
    label:
      participation >= 70
        ? `Votes on ${Math.round(participation)}% of proposals`
        : participation >= 40
          ? `Votes on ${Math.round(participation)}% of proposals`
          : `Limited voting (${Math.round(participation)}%)`,
    value: participation,
    status: participation >= 70 ? 'strong' : participation >= 40 ? 'moderate' : 'weak',
  });

  // Rationale
  const rationaleRate = data.rationaleRate;
  signals.push({
    key: 'rationale',
    label:
      rationaleRate >= 60
        ? 'Writes rationale on most votes'
        : rationaleRate >= 30
          ? 'Sometimes provides rationale'
          : 'Rarely provides rationale',
    value: rationaleRate,
    status: rationaleRate >= 60 ? 'strong' : rationaleRate >= 30 ? 'moderate' : 'weak',
  });

  // Reliability
  const { reliabilityStreak, reliabilityRecency } = data;
  const reliabilityStatus: 'strong' | 'moderate' | 'weak' =
    reliabilityStreak >= 10 ? 'strong' : reliabilityRecency <= 2 ? 'moderate' : 'weak';

  signals.push({
    key: 'reliability',
    label:
      reliabilityStreak >= 10
        ? `Active ${reliabilityStreak} consecutive epochs`
        : reliabilityRecency <= 2
          ? 'Voted recently'
          : `Inactive for ${reliabilityRecency} epochs`,
    value: reliabilityStreak,
    status: reliabilityStatus,
  });

  // Delegation trend
  const trend = data.delegationTrend;
  if (trend.length >= 2) {
    const latest = trend[trend.length - 1];
    const previous = trend[trend.length - 2];
    const change =
      previous.votingPowerAda > 0
        ? ((latest.votingPowerAda - previous.votingPowerAda) / previous.votingPowerAda) * 100
        : 0;

    const trendStatus: 'strong' | 'moderate' | 'weak' =
      change > 5 ? 'strong' : change > -5 ? 'moderate' : 'weak';

    signals.push({
      key: 'delegation_trend',
      label:
        change > 5
          ? `Growing delegation (+${Math.round(change)}%)`
          : change > -5
            ? 'Stable delegation'
            : `Declining delegation (${Math.round(change)}%)`,
      value: Math.round(change),
      status: trendStatus,
      detail: `${latest.votingPowerAda.toLocaleString()} ADA delegated`,
    });
  } else {
    signals.push({
      key: 'delegation_trend',
      label: 'Delegation trend unavailable',
      value: 0,
      status: 'weak',
    });
  }

  // Profile quality
  const { profileCompleteness, metadataHashVerified } = data;
  const profileStatus: 'strong' | 'moderate' | 'weak' =
    profileCompleteness >= 80 && metadataHashVerified
      ? 'strong'
      : profileCompleteness >= 50
        ? 'moderate'
        : 'weak';

  signals.push({
    key: 'profile_quality',
    label:
      profileCompleteness >= 80 && metadataHashVerified
        ? 'Complete, verified profile'
        : profileCompleteness >= 50
          ? 'Partial profile'
          : 'Minimal profile',
    value: profileCompleteness,
    status: profileStatus,
    detail: metadataHashVerified ? 'Verified metadata' : undefined,
  });

  return signals;
}

/* ─── Data Helpers ────────────────────────────────────── */

/**
 * Fetch user alignment from DB profile (for authenticated users).
 */
async function fetchUserAlignmentFromDB(userId: string): Promise<AlignmentScores | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_governance_profiles')
      .select('alignment_scores')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.alignment_scores) return null;

    const scores = data.alignment_scores as Record<string, number | null>;
    return {
      treasuryConservative: scores.treasuryConservative ?? null,
      treasuryGrowth: scores.treasuryGrowth ?? null,
      decentralization: scores.decentralization ?? null,
      security: scores.security ?? null,
      innovation: scores.innovation ?? null,
      transparency: scores.transparency ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch proposal classifications for a set of proposals.
 */
async function fetchClassifications(txHashes: string[]): Promise<Map<string, VoteClassification>> {
  if (txHashes.length === 0) return new Map();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('proposal_classifications')
      .select(
        'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
      )
      .in('proposal_tx_hash', txHashes);

    if (error || !data) return new Map();

    const map = new Map<string, VoteClassification>();
    for (const row of data) {
      const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
      map.set(key, {
        dimTreasuryConservative: Number(row.dim_treasury_conservative) || 0,
        dimTreasuryGrowth: Number(row.dim_treasury_growth) || 0,
        dimDecentralization: Number(row.dim_decentralization) || 0,
        dimSecurity: Number(row.dim_security) || 0,
        dimInnovation: Number(row.dim_innovation) || 0,
        dimTransparency: Number(row.dim_transparency) || 0,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Hash alignment scores for cache key stability.
 */
function hashAlignment(alignment: AlignmentScores): string {
  const str = JSON.stringify(alignment);
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

/* ─── Route Handler ───────────────────────────────────── */

export const POST = withRouteHandler(
  async (request, { requestId, userId }) => {
    // 1. Parse drepId from URL
    const drepId = request.nextUrl.pathname.split('/api/drep/')[1]?.split('/')[0];
    if (!drepId) {
      return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
    }

    // 2. Parse and validate body
    let body: z.infer<typeof RequestBodySchema> = undefined;
    try {
      const rawBody = await request.text();
      if (rawBody) {
        body = RequestBodySchema.parse(JSON.parse(rawBody));
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fields = err.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`);
        return NextResponse.json({ error: 'Validation failed', details: fields }, { status: 400 });
      }
      // Non-JSON body -- treat as empty
    }

    // 3. Determine alignment source: DB profile > POST body > null
    let userAlignment: AlignmentScores | null = null;

    if (userId) {
      userAlignment = await fetchUserAlignmentFromDB(userId);
    }

    if (!userAlignment && body?.userAlignment) {
      userAlignment = {
        treasuryConservative: body.userAlignment.treasuryConservative ?? null,
        treasuryGrowth: body.userAlignment.treasuryGrowth ?? null,
        decentralization: body.userAlignment.decentralization ?? null,
        security: body.userAlignment.security ?? null,
        innovation: body.userAlignment.innovation ?? null,
        transparency: body.userAlignment.transparency ?? null,
      };
    }

    // 4. Fetch DRep -- 404 if not found
    const drep = await getDRepById(drepId);
    if (!drep) {
      return NextResponse.json({ error: 'DRep not found' }, { status: 404 });
    }

    // 5. Compute trust signals (always, regardless of alignment)
    const delegationTrend = await getDRepDelegationTrend(drepId);
    const trustSignals = computeTrustSignals({
      effectiveParticipation: drep.effectiveParticipation ?? 0,
      rationaleRate: drep.rationaleRate ?? 0,
      reliabilityStreak: drep.reliabilityStreak ?? 0,
      reliabilityRecency: drep.reliabilityRecency ?? 0,
      profileCompleteness: drep.profileCompleteness ?? 0,
      metadataHashVerified: drep.metadataHashVerified ?? null,
      delegationTrend,
    });

    // 6. If no alignment, return trust signals only
    if (!userAlignment) {
      const response: AlignmentResponse = {
        alignment: null,
        simulation: null,
        comparison: null,
        trustSignals,
      };
      return NextResponse.json(response);
    }

    // 7. Compute alignment and simulation (with caching for authenticated users)
    const computeResult = async (): Promise<{
      alignment: AlignmentSummary | null;
      simulation: DelegationSimulation | null;
    }> => {
      // Fetch DRep votes
      const drepVotes = await getVotesByDRepId(drepId);

      if (drepVotes.length === 0) {
        return { alignment: null, simulation: null };
      }

      // Unique tx hashes for batch fetches
      const txHashes = [...new Set(drepVotes.map((v) => v.proposal_tx_hash))];
      const proposalIds = drepVotes.map((v) => ({
        txHash: v.proposal_tx_hash,
        index: v.proposal_index,
      }));
      const outcomeKeys = drepVotes.map((v) => ({
        txHash: v.proposal_tx_hash,
        proposalIndex: v.proposal_index,
      }));

      // Determine epoch window for total proposal count
      const latestEpoch = Math.max(
        ...drepVotes.filter((v) => v.epoch_no !== null).map((v) => v.epoch_no!),
        0,
      );
      const cutoffEpoch = latestEpoch - 36; // DEFAULT_LOOKBACK_EPOCHS

      // Parallel data fetches — include total proposal count for participation rate
      const [classifications, proposals, outcomes, totalProposalCount] = await Promise.all([
        fetchClassifications(txHashes),
        getProposalsByIds(proposalIds),
        getProposalOutcomesBatch(outcomeKeys),
        createClient()
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .gte('proposed_epoch', cutoffEpoch)
          .then((r) => r.count ?? null),
      ]);

      // Build VoteWithClassification array for WS-1
      const votesWithClassification: VoteWithClassification[] = drepVotes
        .filter((v) => {
          const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
          return classifications.has(key);
        })
        .map((v) => {
          const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
          const proposal = proposals.get(key);
          const classification = classifications.get(key)!;

          return {
            proposalId: key,
            proposalTitle: getProposalDisplayTitle(
              proposal?.title ?? null,
              v.proposal_tx_hash,
              v.proposal_index,
            ),
            proposalType: proposal?.proposalType ?? 'Unknown',
            vote: v.vote,
            epochNo: v.epoch_no ?? 0,
            classification,
          };
        });

      // Compute alignment (WS-1) and simulation (WS-2) in parallel
      const [alignment, simulation] = await Promise.all([
        Promise.resolve(computeProposalAlignment(userAlignment!, votesWithClassification)),
        Promise.resolve(
          computeDelegationSimulation({
            drepVotes,
            proposals,
            outcomes,
            classifications,
            userAlignment,
            totalProposalCount,
          }),
        ),
      ]);

      return { alignment, simulation };
    };

    let result: { alignment: AlignmentSummary | null; simulation: DelegationSimulation | null };

    // Use Redis cache for authenticated users
    if (userId) {
      const alignmentHash = hashAlignment(userAlignment);
      const cacheKey = `align:${userId}:${drepId}:${alignmentHash}`;
      // 1 epoch TTL ~ 5 days = 432,000 seconds
      result = await cached(cacheKey, 432_000, computeResult);
    } else {
      result = await computeResult();
    }

    const response: AlignmentResponse = {
      alignment: result.alignment,
      simulation: result.simulation,
      comparison: null,
      trustSignals,
    };

    logger.info('Alignment API response', {
      context: 'drep/alignment',
      drepId,
      hasAlignment: !!result.alignment,
      hasSimulation: !!result.simulation,
      trustSignalCount: trustSignals.length,
      requestId,
    });

    return NextResponse.json(response);
  },
  { auth: 'optional', rateLimit: { max: 60, window: 60 } },
);
