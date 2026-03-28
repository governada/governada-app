/**
 * DRep Enrichment and Scoring
 * Computes rolled-up DRep Score (0-100) as primary metric.
 * Philosophy: Objective accountability - do they show up, explain, and stay engaged?
 */

import {
  fetchAllDReps,
  fetchDRepsWithDetails,
  fetchDRepVotes,
  checkKoiosHealth,
  parseMetadataFields,
} from '@/utils/koios';
import { logger } from '@/lib/logger';
import { withRetry } from '@/lib/retry';
import type { DRepVotesResponse } from '@/types/koios';
import {
  calculateParticipationRate,
  calculateDeliberationModifier,
  calculateReliability,
  calculateEffectiveParticipation,
  calculateProfileCompleteness,
  calculateWeightedRationaleRate,
  hasQualityRationale,
  applyRationaleCurve,
  lovelaceToAda,
  getSizeTier,
  type ProposalContext,
} from '@/utils/scoring';
import { isWellDocumented } from '@/utils/documentation';
import { DRep } from '@/types/drep';
import { getActiveProposalEpochs, getActualProposalCount } from '@/lib/data';

// ---------------------------------------------------------------------------
// Weighting Philosophy (V3 — Rationale-Forward)
// ---------------------------------------------------------------------------
// DRep Score measures accountability with rationale as the highest signal:
// - Rationale (35%): Do they explain their votes? Highest weight because
//   explaining governance decisions is what separates engaged DReps.
// - Effective Participation (30%): Do they show up? Penalized for rubber-stamping.
// - Reliability (20%): Can delegators count on them to keep showing up?
//   Streak, recency, gap penalty, tenure — orthogonal to participation.
// - Profile Completeness (15%): Do they invest in their public CIP-119 profile?
// ---------------------------------------------------------------------------

/** Weights for DRep Score components (each 0-1, should sum to 1) */
export interface DRepWeights {
  effectiveParticipation: number;
  rationale: number;
  reliability: number;
  profileCompleteness: number;
}

/** Default: rationale-forward weights */
export const DEFAULT_WEIGHTS: DRepWeights = {
  effectiveParticipation: 0.3,
  rationale: 0.35,
  reliability: 0.2,
  profileCompleteness: 0.15,
};

/** DRep with computed drepScore (0-100) and pre-computed alignment scores */
export interface EnrichedDRep extends DRep {
  drepScore: number;
  alignmentTreasuryConservative: number | null;
  alignmentTreasuryGrowth: number | null;
  alignmentDecentralization: number | null;
  alignmentSecurity: number | null;
  alignmentInnovation: number | null;
  alignmentTransparency: number | null;
  lastVoteTime: number | null;
  metadataHashVerified: boolean | null;
  /** ISO timestamp of when this DRep's data was last synced from Koios into the cache */
  updatedAt: string | null;
  // V3 pillar scores
  engagementQuality: number | null;
  engagementQualityRaw: number | null;
  effectiveParticipationV3: number | null;
  effectiveParticipationV3Raw: number | null;
  reliabilityV3: number | null;
  reliabilityV3Raw: number | null;
  governanceIdentity: number | null;
  governanceIdentityRaw: number | null;
  scoreMomentum: number | null;
}

/**
 * Calculate rolled-up DRep Score (0-100).
 * Formula: Rationale (35%) + Effective Participation (30%)
 *          + Reliability (20%) + Profile Completeness (15%)
 *
 * rationaleRate is the raw weighted rate; the forgiving curve is applied here.
 */
export function calculateDRepScore(
  drep: Pick<
    DRep,
    'effectiveParticipation' | 'rationaleRate' | 'reliabilityScore' | 'profileCompleteness'
  >,
  weights: DRepWeights = DEFAULT_WEIGHTS,
): number {
  const effectiveParticipation = drep.effectiveParticipation ?? 0;
  const rationale = applyRationaleCurve(drep.rationaleRate ?? 0);
  const reliability = drep.reliabilityScore ?? 0;
  const profile = drep.profileCompleteness ?? 0;

  const raw =
    (effectiveParticipation / 100) * weights.effectiveParticipation +
    (rationale / 100) * weights.rationale +
    (reliability / 100) * weights.reliability +
    (profile / 100) * weights.profileCompleteness;

  const score = Math.round(raw * 100);

  return Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
}

/** Batch size for Koios API (drep_info/drep_metadata limit) */
const BATCH_SIZE = 50;

import {
  SHELLEY_GENESIS_TIMESTAMP,
  EPOCH_LENGTH_SECONDS,
  SHELLEY_BASE_EPOCH,
} from '@/lib/constants';

/**
 * Derive Cardano epoch number from Unix timestamp (block_time)
 * Validated against known proposal epochs with 100% accuracy
 */
export function blockTimeToEpoch(blockTime: number): number {
  return (
    Math.floor((blockTime - SHELLEY_GENESIS_TIMESTAMP) / EPOCH_LENGTH_SECONDS) + SHELLEY_BASE_EPOCH
  );
}

/**
 * Compute vote counts per epoch from vote array
 * Groups votes by epoch_no (or derives from block_time if missing) and returns array of counts + first epoch
 */
function computeEpochVoteCounts(votes: Awaited<ReturnType<typeof fetchDRepVotes>>): {
  counts: number[];
  firstEpoch: number | undefined;
} {
  if (!votes || votes.length === 0) return { counts: [], firstEpoch: undefined };

  const epochCounts: Record<number, number> = {};
  let minEpoch = Infinity;
  let maxEpoch = -Infinity;

  for (const vote of votes) {
    // Use epoch_no if available, otherwise derive from block_time
    const epoch =
      vote.epoch_no ?? (vote.block_time ? blockTimeToEpoch(vote.block_time) : undefined);
    if (epoch !== undefined && epoch !== null) {
      epochCounts[epoch] = (epochCounts[epoch] || 0) + 1;
      minEpoch = Math.min(minEpoch, epoch);
      maxEpoch = Math.max(maxEpoch, epoch);
    }
  }

  if (minEpoch === Infinity) return { counts: [], firstEpoch: undefined };

  const counts: number[] = [];
  for (let e = minEpoch; e <= maxEpoch; e++) {
    counts.push(epochCounts[e] || 0);
  }

  return { counts, firstEpoch: minEpoch };
}

/** Max concurrent vote fetches to avoid overwhelming the API */
const VOTE_CONCURRENCY = 5;

/**
 * Fetch votes for multiple DReps with limited concurrency
 */
async function fetchVotesBatched(
  drepIds: string[],
): Promise<Record<string, Awaited<ReturnType<typeof fetchDRepVotes>>>> {
  const votesMap: Record<string, Awaited<ReturnType<typeof fetchDRepVotes>>> = {};
  for (let i = 0; i < drepIds.length; i += VOTE_CONCURRENCY) {
    const chunk = drepIds.slice(i, i + VOTE_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (id) => {
        try {
          const votes = await fetchDRepVotes(id);
          return { id, votes };
        } catch (error) {
          logger.error('[DRepScore] Failed to fetch votes', { drepId: id, error });
          return { id, votes: [] };
        }
      }),
    );
    for (const { id, votes } of results) {
      votesMap[id] = votes;
    }
  }
  return votesMap;
}

/**
 * Fetch enriched DReps with drepScore, sorted by score DESC then voting_power DESC.
 * Loads ALL registered DReps in batches (no limit).
 * @param wellDocumentedOnly - If true, filter to well-documented DReps only (default view)
 * @param options.proposalContextMap - When provided, enables proposal-type-weighted rationale scoring
 * @param options.prefetchedVotes - Pre-fetched votes map (from fetchAllVotesBulk). Skips per-DRep vote fetching.
 */
export async function getEnrichedDReps(
  wellDocumentedOnly: boolean = true,
  options?: {
    includeRawVotes?: boolean;
    proposalContextMap?: Map<string, ProposalContext>;
    prefetchedVotes?: Record<string, DRepVotesResponse>;
  },
): Promise<{
  dreps: EnrichedDRep[];
  allDReps: EnrichedDRep[];
  error: boolean;
  totalAvailable: number;
  rawVotesMap?: Record<string, Awaited<ReturnType<typeof fetchDRepVotes>>>;
}> {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    if (isDev) {
      logger.info('[DRepScore] getEnrichedDReps - loading ALL DReps in batches', {
        wellDocumentedOnly,
      });
    }

    const isHealthy = await checkKoiosHealth();
    if (!isHealthy) {
      logger.error('[DRepScore] Koios API health check failed');
      return { dreps: [], allDReps: [], error: true, totalAvailable: 0 };
    }

    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Fetch epochs that had proposals for reliability scoring
    const [activeProposalEpochs, actualProposalCount] = await Promise.all([
      getActiveProposalEpochs(),
      getActualProposalCount(),
    ]);
    if (isDev) {
      logger.info('[DRepScore] Epoch context', {
        currentEpoch,
        activeProposalEpochs: activeProposalEpochs.size,
        actualProposalCount,
      });
    }

    let drepList: Awaited<ReturnType<typeof fetchAllDReps>>;
    try {
      drepList = await withRetry(
        async () => {
          const result = await fetchAllDReps();
          if (!result || result.length === 0) throw new Error('Empty DRep list from fetchAllDReps');
          return result;
        },
        { maxRetries: 2, baseDelayMs: 5000, label: 'getEnrichedDReps' },
      );
    } catch (fetchErr) {
      logger.error('[DRepScore] No DReps found after retry', {
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      return { dreps: [], allDReps: [], error: true, totalAvailable: 0 };
    }

    const registeredDReps = drepList.filter((d) => d.registered);
    const totalAvailable = registeredDReps.length;
    const allDrepIds = registeredDReps.map((d) => d.drep_id);

    if (isDev) {
      logger.info('[DRepScore] Loading all DReps in batches', {
        total: totalAvailable,
        batchSize: BATCH_SIZE,
      });
    }

    const allBaseDreps: DRep[] = [];
    const allRawVotes: Record<string, Awaited<ReturnType<typeof fetchDRepVotes>>> = {};

    for (let offset = 0; offset < allDrepIds.length; offset += BATCH_SIZE) {
      const batchIds = allDrepIds.slice(offset, offset + BATCH_SIZE);
      const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allDrepIds.length / BATCH_SIZE);

      if (isDev) {
        logger.info('[DRepScore] Fetching batch', {
          batch: batchNum,
          totalBatches,
          count: batchIds.length,
        });
      }

      const { info, metadata } = await fetchDRepsWithDetails(batchIds);
      const sortedInfo = [...info].sort((a, b) => {
        const aPower = parseInt(a.amount || '0');
        const bPower = parseInt(b.amount || '0');
        return bPower - aPower;
      });

      const votesMap = options?.prefetchedVotes
        ? Object.fromEntries(
            sortedInfo.map((i) => [i.drep_id, options.prefetchedVotes![i.drep_id] || []]),
          )
        : await fetchVotesBatched(sortedInfo.map((i) => i.drep_id));

      if (options?.includeRawVotes) {
        Object.assign(allRawVotes, votesMap);
      }

      const proposalCtx = options?.proposalContextMap;

      const batchDreps: DRep[] = sortedInfo.map((drepInfo) => {
        const drepMetadata = metadata.find((m) => m.drep_id === drepInfo.drep_id);
        const rawVotes = votesMap[drepInfo.drep_id] || [];

        // Deduplicate: keep only the latest vote per proposal (by block_time)
        const latestByProposal = new Map<string, (typeof rawVotes)[number]>();
        for (const v of rawVotes) {
          const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
          const existing = latestByProposal.get(key);
          if (!existing || v.block_time > existing.block_time) {
            latestByProposal.set(key, v);
          }
        }
        const votes = [...latestByProposal.values()];

        const yesVotes = votes.filter((v) => v.vote === 'Yes').length;
        const noVotes = votes.filter((v) => v.vote === 'No').length;
        const abstainVotes = votes.filter((v) => v.vote === 'Abstain').length;

        const { name, ticker, description } = parseMetadataFields(drepMetadata);
        const votingPower = lovelaceToAda(drepInfo.amount || '0');

        const participationRate = calculateParticipationRate(votes.length, actualProposalCount);

        // V2: Proposal-type-weighted rationale with quality threshold
        let rationaleRate: number;
        if (proposalCtx && proposalCtx.size > 0) {
          rationaleRate = calculateWeightedRationaleRate(votes, proposalCtx);
        } else {
          // Fallback: simple rate with quality check
          const qualityCount = votes.filter((v) => hasQualityRationale(v)).length;
          rationaleRate = votes.length > 0 ? Math.round((qualityCount / votes.length) * 100) : 0;
        }

        const deliberationModifier = calculateDeliberationModifier(yesVotes, noVotes, abstainVotes);
        const effectiveParticipation = calculateEffectiveParticipation(
          participationRate,
          deliberationModifier,
        );

        const { counts: epochVoteCounts, firstEpoch } = computeEpochVoteCounts(votes);
        const reliabilityResult = calculateReliability(
          epochVoteCounts,
          firstEpoch,
          currentEpoch,
          activeProposalEpochs,
        );
        const reliabilityScore = reliabilityResult.score;

        // V2: Profile completeness from CIP-119 metadata
        const metadataBody = drepMetadata?.meta_json?.body || null;
        const profileCompleteness = calculateProfileCompleteness(
          metadataBody as Record<string, unknown> | null,
        );

        return {
          drepId: drepInfo.drep_id,
          drepHash: drepInfo.drep_hash,
          handle: null,
          name,
          ticker,
          description,
          votingPower,
          votingPowerLovelace: drepInfo.amount || '0',
          participationRate,
          rationaleRate,
          reliabilityScore,
          reliabilityStreak: reliabilityResult.streak,
          reliabilityRecency: reliabilityResult.recency,
          reliabilityLongestGap: reliabilityResult.longestGap,
          reliabilityTenure: reliabilityResult.tenure,
          deliberationModifier,
          effectiveParticipation,
          sizeTier: getSizeTier(votingPower),
          delegatorCount: 0, // overwritten by DRep sync step 3b
          totalVotes: votes.length,
          yesVotes,
          noVotes,
          abstainVotes,
          isActive: drepInfo.registered && drepInfo.amount !== '0',
          anchorUrl: drepInfo.anchor_url,
          anchorHash: drepInfo.anchor_hash,
          metadata: metadataBody as Record<string, unknown> | null,
          epochVoteCounts,
          profileCompleteness,
          updatedAt: null,
        };
      });

      allBaseDreps.push(...batchDreps);
    }

    // Participation is already calculated per-DRep using actualProposalCount in the batch loop above.

    // Ensure EVERY DRep gets a drepScore (0-100)
    const enriched: EnrichedDRep[] = allBaseDreps.map((drep) => {
      const drepScore = calculateDRepScore(drep, DEFAULT_WEIGHTS);

      return {
        ...drep,
        drepScore,
        alignmentTreasuryConservative: null,
        alignmentTreasuryGrowth: null,
        alignmentDecentralization: null,
        alignmentSecurity: null,
        alignmentInnovation: null,
        alignmentTransparency: null,
        lastVoteTime: null,
        metadataHashVerified: null,
        updatedAt: null,
        engagementQuality: null,
        engagementQualityRaw: null,
        effectiveParticipationV3: null,
        effectiveParticipationV3Raw: null,
        reliabilityV3: null,
        reliabilityV3Raw: null,
        governanceIdentity: null,
        governanceIdentityRaw: null,
        scoreMomentum: null,
      };
    });

    const sorted = [...enriched].sort((a, b) => {
      if (a.drepScore !== b.drepScore) return b.drepScore - a.drepScore;
      return b.votingPower - a.votingPower;
    });

    const wellDocumentedDReps = sorted.filter((d) => isWellDocumented(d));

    const drepsToReturn = wellDocumentedOnly ? wellDocumentedDReps : sorted;

    if (isDev) {
      logger.info('[DRepScore] Loaded DReps with scores', {
        total: sorted.length,
        wellDocumented: wellDocumentedDReps.length,
      });
    }

    return {
      dreps: drepsToReturn,
      allDReps: sorted,
      error: false,
      totalAvailable,
      ...(options?.includeRawVotes ? { rawVotesMap: allRawVotes } : {}),
    };
  } catch (error) {
    logger.error('[DRepScore] Error in getEnrichedDReps', { error });
    return { dreps: [], allDReps: [], error: true, totalAvailable: 0 };
  }
}
