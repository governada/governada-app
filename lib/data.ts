/**
 * Data Layer - Supabase Cache
 * Fast reads from Supabase with automatic freshness checks and sync triggering
 */

import { createClient } from './supabase';
import { EnrichedDRep } from './koios';
import { isWellDocumented } from '@/utils/documentation';
import { logger } from '@/lib/logger';
import { getCurrentEpoch } from '@/lib/constants';
import { SYNC_FRESHNESS_POLICY } from './syncPolicy';
import {
  buildProposalVoteSummary,
  buildTriBodyVotes,
  summarizeDRepVotes,
  type ProposalWithVoteSummary,
} from './governance/proposalSummary';
import {
  fetchLatestProposalVotingSummary,
  fetchProposalVotingSummaries,
  getProposalVotingSummaryKey,
  indexProposalVotingSummaryTriBodies,
} from './governance/proposalVotingSummary';
export {
  getProposalsByIds,
  getRationalesByVoteTxHashes,
  getVotesByDRepId,
} from './governance/proposalEnrichment';
export type { CachedProposal, DRepVoteRow, RationaleRecord } from './governance/proposalEnrichment';
export type {
  ProposalStatus,
  ProposalWithVoteSummary,
  TriBodyVotes,
} from './governance/proposalSummary';
export { getVotingPowerSummary } from './governance/votingPowerSummary';
export type { VotingPowerSummary } from './governance/votingPowerSummary';
import type { SizeTier } from '@/utils/scoring';

interface DRepRowInfo {
  drepHash?: string;
  handle?: string | null;
  name?: string | null;
  ticker?: string | null;
  description?: string | null;
  votingPower?: number;
  votingPowerLovelace?: string;
  delegatorCount?: number;
  totalVotes?: number;
  yesVotes?: number;
  noVotes?: number;
  abstainVotes?: number;
  isActive?: boolean;
  anchorUrl?: string | null;
  epochVoteCounts?: number[];
  [key: string]: unknown;
}

interface SupabaseDRepRow {
  id: string;
  info: DRepRowInfo | null;
  score: number;
  participation_rate: number;
  rationale_rate: number;
  reliability_score: number;
  reliability_streak: number;
  reliability_recency: number;
  reliability_longest_gap: number;
  reliability_tenure: number;
  deliberation_modifier: number;
  effective_participation: number;
  size_tier: SizeTier;
  anchor_hash: string | null;
  metadata: Record<string, unknown> | null;
  profile_completeness: number;
  alignment_treasury_conservative: number | null;
  alignment_treasury_growth: number | null;
  alignment_decentralization: number | null;
  alignment_security: number | null;
  alignment_innovation: number | null;
  alignment_transparency: number | null;
  last_vote_time: number | null;
  metadata_hash_verified: boolean | null;
  updated_at: string | null;
  engagement_quality: number | null;
  engagement_quality_raw: number | null;
  effective_participation_v3: number | null;
  effective_participation_v3_raw: number | null;
  reliability_v3: number | null;
  reliability_v3_raw: number | null;
  governance_identity: number | null;
  governance_identity_raw: number | null;
  score_momentum: number | null;
}

export class DRepCacheUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DRepCacheUnavailableError';
    if (options && 'cause' in options) {
      this.cause = options.cause;
    }
  }
}

/**
 * Transform Supabase row to EnrichedDRep
 * Full transformation with all fields preserved for API route serving
 */
function transformSupabaseRowToDRep(row: SupabaseDRepRow): EnrichedDRep {
  const info = row.info || ({} as DRepRowInfo);

  return {
    drepId: row.id,
    drepHash: info.drepHash || '',
    handle: info.handle || null,
    name: info.name || null,
    ticker: info.ticker || null,
    description: info.description || null,
    votingPower: info.votingPower || 0,
    votingPowerLovelace: info.votingPowerLovelace || '0',
    participationRate: row.participation_rate || 0,
    rationaleRate: row.rationale_rate || 0,
    reliabilityScore: row.reliability_score || 0,
    reliabilityStreak: row.reliability_streak ?? 0,
    reliabilityRecency: row.reliability_recency ?? 0,
    reliabilityLongestGap: row.reliability_longest_gap ?? 0,
    reliabilityTenure: row.reliability_tenure ?? 0,
    deliberationModifier: row.deliberation_modifier || 1.0,
    effectiveParticipation: row.effective_participation || row.participation_rate || 0,
    sizeTier: row.size_tier || 'Small',
    delegatorCount: info.delegatorCount || 0,
    totalVotes: info.totalVotes || 0,
    yesVotes: info.yesVotes || 0,
    noVotes: info.noVotes || 0,
    abstainVotes: info.abstainVotes || 0,
    isActive: info.isActive || false,
    anchorUrl: info.anchorUrl || null,
    anchorHash: row.anchor_hash || null,
    metadata: row.metadata || null,
    drepScore: row.score || 0,
    epochVoteCounts: info.epochVoteCounts || [],
    profileCompleteness: row.profile_completeness || 0,
    alignmentTreasuryConservative: row.alignment_treasury_conservative ?? null,
    alignmentTreasuryGrowth: row.alignment_treasury_growth ?? null,
    alignmentDecentralization: row.alignment_decentralization ?? null,
    alignmentSecurity: row.alignment_security ?? null,
    alignmentInnovation: row.alignment_innovation ?? null,
    alignmentTransparency: row.alignment_transparency ?? null,
    lastVoteTime: row.last_vote_time ?? null,
    metadataHashVerified: row.metadata_hash_verified ?? null,
    updatedAt: row.updated_at ?? null,
    // V3 pillar scores
    engagementQuality: row.engagement_quality ?? null,
    engagementQualityRaw: row.engagement_quality_raw ?? null,
    effectiveParticipationV3: row.effective_participation_v3 ?? null,
    effectiveParticipationV3Raw: row.effective_participation_v3_raw ?? null,
    reliabilityV3: row.reliability_v3 ?? null,
    reliabilityV3Raw: row.reliability_v3_raw ?? null,
    governanceIdentity: row.governance_identity ?? null,
    governanceIdentityRaw: row.governance_identity_raw ?? null,
    scoreMomentum: row.score_momentum ?? null,
  };
}

let lastSyncTrigger = 0;
let lastProposalsSyncTrigger = 0;
const SYNC_TRIGGER_COOLDOWN_MS = 10 * 60 * 1000; // 10 min debounce

// In-memory cache for getAllDReps — data only changes every 6 hours (sync interval),
// so a 5-minute TTL eliminates redundant Supabase queries for API and page requests.
const DREPS_CACHE_TTL_MS = 5 * 60 * 1000;
let _drepsCache: {
  data: { dreps: EnrichedDRep[]; allDReps: EnrichedDRep[]; error: boolean; totalAvailable: number };
  timestamp: number;
} | null = null;

/**
 * Trigger background sync without blocking.
 * In production, fires an Inngest event to retrigger the DReps sync.
 * Debounced to avoid spamming events when reads notice the sync is overdue.
 */
async function triggerBackgroundSync() {
  if (Date.now() - lastSyncTrigger < SYNC_TRIGGER_COOLDOWN_MS) return;
  lastSyncTrigger = Date.now();

  try {
    const { inngest } = await import('@/lib/inngest');
    await inngest.send({ name: 'drepscore/sync.dreps' });
    logger.info('[Data] Stale data detected — triggered background DReps sync via Inngest');
  } catch (e) {
    logger.warn('[Data] Failed to trigger background sync', { error: e });
  }
}

async function triggerProposalsSync() {
  if (Date.now() - lastProposalsSyncTrigger < SYNC_TRIGGER_COOLDOWN_MS) return;
  lastProposalsSyncTrigger = Date.now();

  try {
    const { inngest } = await import('@/lib/inngest');
    await inngest.send({ name: 'drepscore/sync.proposals' });
    logger.info('[Data] Empty proposals — triggered background proposals sync via Inngest');
  } catch (e) {
    logger.warn('[Data] Failed to trigger proposals sync', { error: e });
  }
}

/**
 * Get all DReps from the Supabase read model.
 */
export async function getAllDReps(): Promise<{
  dreps: EnrichedDRep[];
  allDReps: EnrichedDRep[];
  error: boolean;
  totalAvailable: number;
}> {
  const isDev = process.env.NODE_ENV === 'development';

  // Return cached result if fresh
  if (_drepsCache && Date.now() - _drepsCache.timestamp < DREPS_CACHE_TTL_MS) {
    return _drepsCache.data;
  }

  try {
    if (isDev) {
      logger.info('[Data] Querying Supabase cache...');
    }

    const supabase = createClient();

    // Query all DReps ordered by score (paginate to bypass PostgREST 1000-row default)
    const PAGE_SIZE = 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: any[] = [];
    let offset = 0;

    // Dynamic pagination: keep fetching until we get a partial page
    // Handles any number of DReps (previously capped at 2000)
    while (rows.length === offset) {
      const { data: page, error: pageError } = await supabase
        .from('dreps')
        .select('*')
        .order('score', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
        .abortSignal(AbortSignal.timeout(10_000));

      if (pageError) {
        logger.error('[Data] Supabase query failed', { error: pageError.message });
        throw new Error('Supabase unavailable');
      }

      const pageRows = page || [];
      rows = [...rows, ...pageRows];

      if (pageRows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (!rows || rows.length === 0) {
      logger.warn('[Data] No DRep data in Supabase cache');
      logger.warn('[Data] Run: npm run sync');
      throw new DRepCacheUnavailableError('DRep cache is empty');
    }

    if (isDev) {
      logger.info('[Data] Retrieved DReps from Supabase', { count: rows.length });
    }

    // Check freshness
    const timestamps = rows
      .map((r) => (r.updated_at ? new Date(r.updated_at).getTime() : 0))
      .filter((t) => t > 0);

    if (timestamps.length > 0) {
      const maxTimestamp = Math.max(...timestamps);
      const maxUpdatedAt = new Date(maxTimestamp);
      const retriggerThreshold = new Date(
        Date.now() - SYNC_FRESHNESS_POLICY.dreps.retriggerAfterMinutes * 60 * 1000,
      );
      const isStale = maxUpdatedAt < retriggerThreshold;

      if (isStale) {
        const ageMinutes = Math.round((Date.now() - maxTimestamp) / 1000 / 60);
        if (isDev) {
          logger.info('[Data] Cache is overdue for retrigger', {
            ageMinutes,
            retriggerAfterMinutes: SYNC_FRESHNESS_POLICY.dreps.retriggerAfterMinutes,
          });
        }
        // Trigger sync in background (non-blocking)
        void triggerBackgroundSync();
      } else if (isDev) {
        const ageMinutes = Math.round((Date.now() - maxTimestamp) / 1000 / 60);
        logger.info('[Data] Cache is fresh', { ageMinutes });
      }
    }

    // Transform Supabase rows to EnrichedDRep[] (full data)
    const allDReps = rows.map(transformSupabaseRowToDRep);

    // Filter to well-documented DReps (default view)
    const wellDocumentedDReps = allDReps.filter((d) => isWellDocumented(d));

    if (isDev) {
      logger.info('[Data] Well documented filter', {
        wellDocumented: wellDocumentedDReps.length,
        total: allDReps.length,
      });
    }

    const result = {
      dreps: wellDocumentedDReps,
      allDReps: allDReps,
      error: false,
      totalAvailable: allDReps.length,
    };
    _drepsCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error: unknown) {
    if (error instanceof DRepCacheUnavailableError) {
      throw error;
    }

    logger.error('[Data] Cache read failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new DRepCacheUnavailableError('DRep cache unavailable', { cause: error });
  }
}

/**
 * Get proposal counts per epoch using lifecycle-aware counting.
 * Each proposal is counted in every epoch it was active (from proposed_epoch
 * through the earliest of expired/ratified/dropped epoch, or current epoch).
 * Returns Map<epoch, proposalCount> for reliability scoring.
 */
export async function getActiveProposalEpochs(): Promise<Map<number, number>> {
  try {
    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from('proposals')
      .select('proposed_epoch, expired_epoch, ratified_epoch, dropped_epoch')
      .not('proposed_epoch', 'is', null);

    if (error || !rows) return new Map();

    // Derive current epoch from timestamp
    const currentEpoch = getCurrentEpoch();

    const counts = new Map<number, number>();
    for (const row of rows) {
      if (row.proposed_epoch == null) continue;
      const start = row.proposed_epoch;
      // End epoch is the earliest lifecycle termination, or current epoch
      const endEpoch = Math.min(
        ...[row.expired_epoch, row.ratified_epoch, row.dropped_epoch, currentEpoch].filter(
          (e): e is number => e != null,
        ),
      );
      for (let e = start; e <= endEpoch; e++) {
        counts.set(e, (counts.get(e) || 0) + 1);
      }
    }

    return counts;
  } catch {
    return new Map();
  }
}

/**
 * Last known-good proposal count, updated periodically.
 * Used as fallback when Supabase is unreachable. Must be kept roughly current
 * to avoid inflating participation rates.
 */
const FALLBACK_PROPOSAL_COUNT = 300;

/**
 * Get the actual total number of governance proposals from the proposals table.
 * Used as the denominator for participation rate calculations.
 */
export async function getActualProposalCount(): Promise<number> {
  try {
    const supabase = createClient();

    const { count, error } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.warn('[Data] getActualProposalCount query failed', { error: error.message });
      return FALLBACK_PROPOSAL_COUNT;
    }

    return count && count > 0 ? count : FALLBACK_PROPOSAL_COUNT;
  } catch (err) {
    logger.error('[Data] getActualProposalCount error', { error: err });
    return FALLBACK_PROPOSAL_COUNT;
  }
}

/**
 * Get a single DRep by ID
 * Returns DRep data or null if not found
 */
export async function getDRepById(drepId: string): Promise<EnrichedDRep | null> {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    if (isDev) {
      logger.info('[Data] Querying Supabase for DRep', { drepId });
    }

    const supabase = createClient();

    const { data: row, error: supabaseError } = await supabase
      .from('dreps')
      .select('*')
      .eq('id', drepId)
      .abortSignal(AbortSignal.timeout(10_000))
      .single();

    if (supabaseError) {
      logger.error('[Data] Supabase query failed', { error: supabaseError.message });
      throw new Error('Supabase unavailable');
    }

    if (!row) {
      if (isDev) {
        logger.warn('[Data] DRep not found in cache', { drepId });
      }
      return null;
    }

    if (isDev) {
      logger.info('[Data] Found DRep in cache', { drepId });
    }

    return transformSupabaseRowToDRep(row);
  } catch (error: unknown) {
    logger.error('[Data] Cache read failed for DRep', {
      drepId,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

// ============================================================================
// PROPOSALS SECTION DATA
// ============================================================================

/**
 * Get all proposals with vote summary counts.
 * Fetches proposals from Supabase and aggregates votes.
 */
export async function getAllProposalsWithVoteSummary(): Promise<ProposalWithVoteSummary[]> {
  try {
    const supabase = createClient();

    // Fetch all proposals
    const { data: proposals, error: pError } = await supabase
      .from('proposals')
      .select('*')
      .order('block_time', { ascending: false })
      .abortSignal(AbortSignal.timeout(10_000));

    if (pError || !proposals) {
      logger.warn('[Data] getAllProposals query failed', { error: pError?.message });
      triggerProposalsSync();
      return [];
    }

    if (proposals.length === 0) {
      triggerProposalsSync();
      return [];
    }

    const proposalTxHashes = [...new Set(proposals.map((proposal) => proposal.tx_hash))];

    // Fetch tri-body vote summaries + voter DRep IDs (just the IDs, not full vote rows)
    const [votingSummaryRows, voterIdsResult] = await Promise.all([
      fetchProposalVotingSummaries(
        supabase,
        proposalTxHashes,
        'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
      ),
      supabase
        .from('drep_votes')
        .select('proposal_tx_hash, proposal_index, drep_id')
        .in('proposal_tx_hash', proposalTxHashes),
    ]);

    const triBodyMap = indexProposalVotingSummaryTriBodies(votingSummaryRows);

    // Build voter DRep ID sets per proposal
    const voterMap = new Map<string, Set<string>>();
    if (voterIdsResult.data) {
      for (const v of voterIdsResult.data) {
        const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
        let set = voterMap.get(key);
        if (!set) {
          set = new Set<string>();
          voterMap.set(key, set);
        }
        if (v.drep_id) set.add(v.drep_id);
      }
    }

    return proposals.map((p) => {
      const key = getProposalVotingSummaryKey(p.tx_hash, p.proposal_index);
      const triBody = triBodyMap.get(key);
      const voters = voterMap.get(key);
      return buildProposalVoteSummary({
        proposal: p,
        drepCounts: triBody?.drep,
        voterDrepIds: voters ?? [],
        triBody,
      });
    });
  } catch (err) {
    logger.error('[Data] getAllProposalsWithVoteSummary error', { error: err });
    return [];
  }
}

export interface ProposalVoteDetail {
  voteTxHash: string;
  drepId: string;
  drepName: string | null;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
  votingPowerLovelace: number | null;
  rationaleText: string | null;
  rationaleAiSummary: string | null;
  hashVerified: boolean | null;
  metaUrl: string | null;
  alignments?: {
    treasuryConservative: number | null;
    treasuryGrowth: number | null;
    decentralization: number | null;
    security: number | null;
    innovation: number | null;
    transparency: number | null;
  } | null;
}

/**
 * Get a single proposal with full metadata.
 */
export async function getProposalByKey(
  txHash: string,
  proposalIndex: number,
): Promise<ProposalWithVoteSummary | null> {
  try {
    const supabase = createClient();

    const [proposalResult, votesResult, summaryResult] = await Promise.all([
      supabase
        .from('proposals')
        .select('*')
        .eq('tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .single(),
      supabase
        .from('drep_votes')
        .select('vote, drep_id')
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex),
      fetchLatestProposalVotingSummary(
        supabase,
        { txHash, proposalIndex },
        'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
      ),
    ]);

    const { data: row, error } = proposalResult;
    if (error || !row) return null;

    const voteSummary = summarizeDRepVotes(votesResult.data);

    const s = summaryResult;
    const triBody = s ? buildTriBodyVotes(s) : undefined;

    return buildProposalVoteSummary({
      proposal: row,
      drepCounts: voteSummary.drepCounts,
      voterDrepIds: voteSummary.voterDrepIds,
      triBody,
    });
  } catch (err) {
    logger.error('[Data] getProposalByKey error', { error: err });
    return null;
  }
}

/**
 * Get all votes for a specific proposal, enriched with DRep names and rationale.
 */
export async function getVotesByProposal(
  txHash: string,
  proposalIndex: number,
): Promise<ProposalVoteDetail[]> {
  try {
    const supabase = createClient();

    const { data: votes, error } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash, drep_id, vote, block_time, meta_url, voting_power_lovelace')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .order('block_time', { ascending: false });

    if (error || !votes) return [];

    // Fetch DRep names/alignment and vote rationales in parallel (both depend only on votes)
    const drepIds = [...new Set(votes.map((v) => v.drep_id))];
    const voteTxHashes = votes.map((v) => v.vote_tx_hash);

    const [drepsResult, rationalesResult] = await Promise.all([
      supabase
        .from('dreps')
        .select(
          'id, info, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .in('id', drepIds),
      supabase
        .from('vote_rationales')
        .select('vote_tx_hash, rationale_text, ai_summary, hash_verified')
        .in('vote_tx_hash', voteTxHashes),
    ]);

    const dreps = drepsResult.data;
    const rationales = rationalesResult.data;

    const drepNameMap = new Map<string, string | null>();
    const drepAlignmentMap = new Map<string, ProposalVoteDetail['alignments']>();
    if (dreps) {
      for (const d of dreps) {
        drepNameMap.set(d.id, (d.info as DRepRowInfo | null)?.name || null);
        drepAlignmentMap.set(d.id, {
          treasuryConservative: d.alignment_treasury_conservative,
          treasuryGrowth: d.alignment_treasury_growth,
          decentralization: d.alignment_decentralization,
          security: d.alignment_security,
          innovation: d.alignment_innovation,
          transparency: d.alignment_transparency,
        });
      }
    }

    const rationaleMap = new Map<
      string,
      { text: string | null; summary: string | null; verified: boolean | null }
    >();
    if (rationales) {
      for (const r of rationales) {
        rationaleMap.set(r.vote_tx_hash, {
          text: r.rationale_text || null,
          summary: r.ai_summary || null,
          verified: r.hash_verified ?? null,
        });
      }
    }

    return votes.map((v) => {
      const rat = rationaleMap.get(v.vote_tx_hash);
      return {
        voteTxHash: v.vote_tx_hash,
        drepId: v.drep_id,
        drepName: drepNameMap.get(v.drep_id) || null,
        vote: v.vote as 'Yes' | 'No' | 'Abstain',
        blockTime: v.block_time,
        votingPowerLovelace: v.voting_power_lovelace ?? null,
        rationaleText: rat?.text || null,
        rationaleAiSummary: rat?.summary || null,
        hashVerified: rat?.verified ?? null,
        metaUrl: v.meta_url,
        alignments: drepAlignmentMap.get(v.drep_id) || null,
      };
    });
  } catch (err) {
    logger.error('[Data] getVotesByProposal error', { error: err });
    return [];
  }
}

// ============================================================================
// VOTE POWER BY EPOCH (for adoption curve)
// ============================================================================

export interface VotePowerByEpoch {
  epoch: number;
  yesPower: number;
  noPower: number;
  abstainPower: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

/**
 * Fetch aggregated voting power and counts per epoch for a proposal.
 * Used by the VoteAdoptionCurve chart to show ADA-weighted power over time.
 */
export async function getVotePowerByEpoch(
  txHash: string,
  proposalIndex: number,
): Promise<VotePowerByEpoch[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('drep_votes')
      .select('epoch_no, vote, voting_power_lovelace')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .not('epoch_no', 'is', null);

    if (error || !data) return [];

    // Aggregate by epoch
    const byEpoch = new Map<
      number,
      {
        yesPower: number;
        noPower: number;
        abstainPower: number;
        yesCount: number;
        noCount: number;
        abstainCount: number;
      }
    >();

    for (const row of data) {
      const epoch = row.epoch_no!;
      const power = Number(row.voting_power_lovelace) || 0;
      const bucket = byEpoch.get(epoch) ?? {
        yesPower: 0,
        noPower: 0,
        abstainPower: 0,
        yesCount: 0,
        noCount: 0,
        abstainCount: 0,
      };

      if (row.vote === 'Yes') {
        bucket.yesPower += power;
        bucket.yesCount++;
      } else if (row.vote === 'No') {
        bucket.noPower += power;
        bucket.noCount++;
      } else {
        bucket.abstainPower += power;
        bucket.abstainCount++;
      }

      byEpoch.set(epoch, bucket);
    }

    return [...byEpoch.entries()].sort(([a], [b]) => a - b).map(([epoch, d]) => ({ epoch, ...d }));
  } catch (err) {
    logger.error('[Data] getVotePowerByEpoch error', { error: err });
    return [];
  }
}

// ============================================================================
// SPO & CC VOTES
// ============================================================================

export interface SpoVoteDetail {
  poolId: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
}

export interface CcVoteDetail {
  ccHotId: string;
  ccColdId: string | null;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
}

export async function getSpoVotesByProposal(
  txHash: string,
  proposalIndex: number,
): Promise<SpoVoteDetail[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('spo_votes')
      .select('pool_id, vote, block_time')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .order('block_time', { ascending: false });

    if (error || !data) return [];
    return data.map((v) => ({
      poolId: v.pool_id,
      vote: v.vote as 'Yes' | 'No' | 'Abstain',
      blockTime: v.block_time,
    }));
  } catch {
    return [];
  }
}

export async function getCcVotesByProposal(
  txHash: string,
  proposalIndex: number,
): Promise<CcVoteDetail[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cc_votes')
      .select('cc_hot_id, cc_cold_id, vote, block_time')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .order('block_time', { ascending: false });

    if (error || !data) return [];
    return data.map((v) => ({
      ccHotId: v.cc_hot_id,
      ccColdId: v.cc_cold_id ?? null,
      vote: v.vote as 'Yes' | 'No' | 'Abstain',
      blockTime: v.block_time,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// CC CONSTITUTIONAL FIDELITY
// ============================================================================

export interface CCFidelitySnapshot {
  epochNo: number;
  fidelityScore: number;
  participationScore: number;
  constitutionalGroundingScore: number;
  reasoningQualityScore: number;
  votesCast: number;
  eligibleProposals: number;
}

export async function getCCFidelityHistory(ccHotId: string): Promise<CCFidelitySnapshot[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cc_fidelity_snapshots')
      .select('*')
      .eq('cc_hot_id', ccHotId)
      .order('epoch_no', { ascending: true });

    if (error || !data) return [];
    return data.map((s) => ({
      epochNo: s.epoch_no,
      fidelityScore: s.fidelity_score ?? 0,
      participationScore: s.participation_score ?? 0,
      constitutionalGroundingScore: s.constitutional_grounding_score ?? 0,
      reasoningQualityScore: s.rationale_quality_score ?? 0,
      votesCast: s.votes_cast ?? 0,
      eligibleProposals: s.eligible_proposals ?? 0,
    }));
  } catch {
    return [];
  }
}

export interface CCMemberFidelity {
  ccHotId: string;
  ccColdId: string | null;
  authorName: string | null;
  status: string | null;
  expirationEpoch: number | null;
  authorizationEpoch: number | null;
  fidelityScore: number | null;
  fidelityGrade: string | null;
  participationScore: number | null;
  constitutionalGroundingScore: number | null;
  reasoningQualityScore: number | null;
  rationaleProvisionRate: number | null;
  avgArticleCoverage: number | null;
  avgReasoningQuality: number | null;
  votesCast: number | null;
  eligibleProposals: number | null;
}

export async function getCCMembersFidelity(): Promise<CCMemberFidelity[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cc_members')
      .select(
        'cc_hot_id, cc_cold_id, author_name, status, expiration_epoch, authorization_epoch, fidelity_score, fidelity_grade, participation_score, rationale_quality_score, constitutional_grounding_score, rationale_provision_rate, avg_article_coverage, avg_reasoning_quality, votes_cast, eligible_proposals',
      )
      .order('fidelity_score', { ascending: false, nullsFirst: false });

    if (error || !data) return [];
    return data.map((m) => ({
      ccHotId: m.cc_hot_id,
      ccColdId: m.cc_cold_id ?? null,
      authorName: m.author_name,
      status: m.status,
      expirationEpoch: m.expiration_epoch,
      authorizationEpoch: m.authorization_epoch,
      fidelityScore: m.fidelity_score,
      fidelityGrade: m.fidelity_grade,
      participationScore: m.participation_score,
      constitutionalGroundingScore: m.constitutional_grounding_score,
      reasoningQualityScore: m.rationale_quality_score,
      rationaleProvisionRate: m.rationale_provision_rate,
      avgArticleCoverage: m.avg_article_coverage,
      avgReasoningQuality: m.avg_reasoning_quality,
      votesCast: m.votes_cast,
      eligibleProposals: m.eligible_proposals,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// CC PROPOSAL FIDELITY SNAPSHOTS
// ============================================================================

export interface CCProposalFidelitySnapshot {
  proposalTxHash: string;
  proposalIndex: number;
  proposalEpoch: number;
  fidelityScore: number;
  participationScore: number;
  constitutionalGroundingScore: number;
  reasoningQualityScore: number;
  votesCast: number;
  eligibleProposals: number;
}

export async function getCCProposalFidelityHistory(
  ccHotId: string,
): Promise<CCProposalFidelitySnapshot[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cc_fidelity_proposal_snapshots')
      .select(
        'proposal_tx_hash, proposal_index, proposal_epoch, fidelity_score, participation_score, constitutional_grounding_score, reasoning_quality_score, votes_cast, eligible_proposals',
      )
      .eq('cc_hot_id', ccHotId)
      .order('proposal_epoch', { ascending: true, nullsFirst: false });

    if (error || !data) return [];
    return data
      .filter((s) => s.proposal_epoch != null && s.fidelity_score != null)
      .map((s) => ({
        proposalTxHash: s.proposal_tx_hash,
        proposalIndex: s.proposal_index,
        proposalEpoch: s.proposal_epoch!,
        fidelityScore: s.fidelity_score!,
        participationScore: s.participation_score ?? 0,
        constitutionalGroundingScore: s.constitutional_grounding_score ?? 0,
        reasoningQualityScore: s.reasoning_quality_score ?? 0,
        votesCast: s.votes_cast ?? 0,
        eligibleProposals: s.eligible_proposals ?? 0,
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// CC HEALTH SUMMARY & MEMBER VERDICTS
// ============================================================================

export interface CCHealthSummary {
  status: 'healthy' | 'attention' | 'critical';
  narrative: string;
  trend: 'improving' | 'stable' | 'declining';
  activeMembers: number;
  totalMembers: number;
  avgFidelity: number | null;
  tensionCount: number;
}

export interface CCMemberVerdict {
  ccHotId: string;
  rank: number;
  total: number;
  narrative: string;
  strongestPillar: string | null;
  weakestPillar: string | null;
  trend: 'improving' | 'stable' | 'declining';
}

export async function getCCHealthSummary(): Promise<CCHealthSummary> {
  const { interpretHealthStatus, generateCCHealthNarrative } =
    await import('@/lib/cc/interpretations');

  try {
    const supabase = createClient();

    // Parallel fetches: members, tension data, and latest snapshots for trend
    const [members, { data: alignmentRows }, { data: votes }, { data: stats }] = await Promise.all([
      getCCMembersFidelity(),
      supabase
        .from('inter_body_alignment')
        .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct'),
      supabase
        .from('cc_votes')
        .select('cc_hot_id, cc_cold_id, proposal_tx_hash, proposal_index, vote'),
      supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
    ]);

    const currentEpoch = stats?.current_epoch ?? 0;
    const activeMembers = members.filter((m) => m.status === 'authorized').length;
    const totalMembers = activeMembers; // Only count active members — expired ones are historical
    const scoredMembers = members.filter((m) => m.fidelityScore != null);
    const avgFidelity =
      scoredMembers.length > 0
        ? Math.round(
            scoredMembers.reduce((sum, m) => sum + (m.fidelityScore ?? 0), 0) /
              scoredMembers.length,
          )
        : null;

    // Count tension proposals (where CC unanimous vote diverges from DRep majority)
    const safeVotes = votes ?? [];
    const alignmentMap = new Map<string, string>();
    for (const row of alignmentRows ?? []) {
      const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
      const drepMaj =
        row.drep_yes_pct > row.drep_no_pct
          ? 'Yes'
          : row.drep_no_pct > row.drep_yes_pct
            ? 'No'
            : 'Abstain';
      alignmentMap.set(key, drepMaj);
    }

    const proposalVotes = new Map<string, Map<string, string>>();
    for (const v of safeVotes) {
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      const voteMap = proposalVotes.get(key) ?? new Map<string, string>();
      voteMap.set(v.cc_cold_id ?? v.cc_hot_id, v.vote);
      proposalVotes.set(key, voteMap);
    }

    let tensionCount = 0;
    for (const [key, voteMap] of proposalVotes) {
      const allVotes = Array.from(voteMap.values());
      if (allVotes.length < totalMembers || totalMembers === 0) continue;
      const first = allVotes[0];
      const isUnanimous = allVotes.every((v) => v === first);
      if (isUnanimous) {
        const drepMaj = alignmentMap.get(key);
        if (drepMaj && drepMaj !== 'Abstain' && first !== drepMaj) tensionCount++;
      }
    }

    // Trend: compare current epoch avg vs 3 epochs ago
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (currentEpoch > 3 && scoredMembers.length > 0) {
      const { data: oldSnapshots } = await supabase
        .from('cc_fidelity_snapshots')
        .select('fidelity_score')
        .eq('epoch_no', currentEpoch - 3);

      if (oldSnapshots && oldSnapshots.length > 0) {
        const oldAvg = Math.round(
          oldSnapshots.reduce((s, r) => s + (r.fidelity_score ?? 0), 0) / oldSnapshots.length,
        );
        const delta = (avgFidelity ?? 0) - oldAvg;
        if (delta > 2) trend = 'improving';
        else if (delta < -2) trend = 'declining';
      }
    }

    const healthData = { activeMembers, totalMembers, avgFidelity, tensionCount, trend };
    const status = interpretHealthStatus(healthData);
    const narrative = generateCCHealthNarrative(healthData);

    return { status, narrative, trend, activeMembers, totalMembers, avgFidelity, tensionCount };
  } catch {
    return {
      status: 'attention',
      narrative: 'Unable to compute CC health summary.',
      trend: 'stable',
      activeMembers: 0,
      totalMembers: 0,
      avgFidelity: null,
      tensionCount: 0,
    };
  }
}

export async function getCCMemberVerdicts(): Promise<CCMemberVerdict[]> {
  const { generateMemberVerdict, interpretTrend } = await import('@/lib/cc/interpretations');

  try {
    const supabase = createClient();
    const members = await getCCMembersFidelity();
    if (members.length === 0) return [];

    // Get latest 2 snapshots per member for trend
    const { data: snapshots } = await supabase
      .from('cc_fidelity_snapshots')
      .select('cc_hot_id, epoch_no, fidelity_score')
      .order('epoch_no', { ascending: false })
      .limit(members.length * 5);

    const snapshotsByMember = new Map<string, { epoch: number; index: number }[]>();
    for (const s of snapshots ?? []) {
      const list = snapshotsByMember.get(s.cc_hot_id) ?? [];
      list.push({ epoch: s.epoch_no, index: s.fidelity_score ?? 0 });
      snapshotsByMember.set(s.cc_hot_id, list);
    }

    const PILLAR_LABELS: Record<string, string> = {
      participation: 'Participation',
      constitutionalGrounding: 'Constitutional Engagement',
      reasoningQuality: 'Reasoning Quality',
    };

    return members.map((m, i) => {
      const rank = i + 1;
      const total = members.length;

      // Find strongest/weakest pillar
      const pillars: [string, number | null][] = [
        ['participation', m.participationScore],
        ['constitutionalGrounding', m.constitutionalGroundingScore],
        ['reasoningQuality', m.reasoningQualityScore],
      ];
      const validPillars = pillars.filter(([, v]) => v != null) as [string, number][];
      const sorted = [...validPillars].sort((a, b) => b[1] - a[1]);
      const strongest = sorted.length > 0 ? PILLAR_LABELS[sorted[0][0]] : null;
      const weakest = sorted.length > 1 ? PILLAR_LABELS[sorted[sorted.length - 1][0]] : null;

      // Compute trend
      const memberSnaps = snapshotsByMember.get(m.ccHotId) ?? [];
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (memberSnaps.length >= 2) {
        const current = memberSnaps[0].index;
        const previous = memberSnaps[Math.min(2, memberSnaps.length - 1)].index;
        const epochSpan =
          memberSnaps[0].epoch - memberSnaps[Math.min(2, memberSnaps.length - 1)].epoch;
        const trendStr = interpretTrend(current, previous, epochSpan);
        if (trendStr.startsWith('Improving')) trend = 'improving';
        else if (trendStr.startsWith('Declining')) trend = 'declining';
      }

      const narrative = generateMemberVerdict({
        rank,
        total,
        fidelityScore: m.fidelityScore,
        trend,
        strongestPillar: strongest,
        weakestPillar: weakest,
        participationRate:
          m.votesCast != null && m.eligibleProposals != null && m.eligibleProposals > 0
            ? Math.round((m.votesCast / m.eligibleProposals) * 100)
            : null,
      });

      return {
        ccHotId: m.ccHotId,
        rank,
        total,
        narrative,
        strongestPillar: strongest,
        weakestPillar: weakest,
        trend,
      };
    });
  } catch {
    return [];
  }
}

// ============================================================================
// GOVERNANCE INBOX
// ============================================================================

export interface OpenProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  abstract: string | null;
  aiSummary: string | null;
  proposalType: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  relevantPrefs: string[];
  proposedEpoch: number | null;
  expirationEpoch: number | null;
  blockTime: number | null;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
}

/**
 * Get open proposals that a specific DRep has NOT voted on.
 * "Open" = no ratified, enacted, dropped, or expired epoch set.
 */
export async function getOpenProposalsForDRep(drepId: string): Promise<OpenProposal[]> {
  try {
    const supabase = createClient();

    const { data: proposals, error: pError } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, withdrawal_amount, treasury_tier, relevant_prefs, proposed_epoch, expiration_epoch, block_time',
      )
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('block_time', { ascending: false });

    if (pError || !proposals || proposals.length === 0) return [];

    // Fetch DRep's votes + vote summaries in parallel (both depend only on proposals result)
    const openTxHashes = proposals.map((p) => p.tx_hash);
    const [drepVotesResult, summaryRows] = await Promise.all([
      supabase.from('drep_votes').select('proposal_tx_hash, proposal_index').eq('drep_id', drepId),
      fetchProposalVotingSummaries(
        supabase,
        openTxHashes,
        'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
      ),
    ]);

    const votedKeys = new Set<string>();
    if (!drepVotesResult.error && drepVotesResult.data) {
      for (const v of drepVotesResult.data) {
        votedKeys.add(`${v.proposal_tx_hash}-${v.proposal_index}`);
      }
    }

    const countMap = new Map<string, { yes: number; no: number; abstain: number }>();
    for (const s of summaryRows) {
      if (s.proposal_tx_hash && openTxHashes.includes(s.proposal_tx_hash)) {
        const key = getProposalVotingSummaryKey(s.proposal_tx_hash, s.proposal_index);
        countMap.set(key, {
          yes: s.drep_yes_votes_cast || 0,
          no: s.drep_no_votes_cast || 0,
          abstain: s.drep_abstain_votes_cast || 0,
        });
      }
    }

    // Filter to proposals the DRep hasn't voted on
    return proposals
      .filter((p) => !votedKeys.has(`${p.tx_hash}-${p.proposal_index}`))
      .map((p) => {
        const key = getProposalVotingSummaryKey(p.tx_hash, p.proposal_index);
        const counts = countMap.get(key) || { yes: 0, no: 0, abstain: 0 };
        return {
          txHash: p.tx_hash,
          proposalIndex: p.proposal_index,
          title: p.title,
          abstract: p.abstract,
          aiSummary: p.ai_summary || null,
          proposalType: p.proposal_type,
          withdrawalAmount: p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null,
          treasuryTier: p.treasury_tier,
          relevantPrefs: p.relevant_prefs || [],
          proposedEpoch: p.proposed_epoch,
          expirationEpoch: p.expiration_epoch ?? null,
          blockTime: p.block_time,
          yesCount: counts.yes,
          noCount: counts.no,
          abstainCount: counts.abstain,
          totalVotes: counts.yes + counts.no + counts.abstain,
        };
      });
  } catch (err) {
    logger.error('[Data] getOpenProposalsForDRep error', { error: err });
    return [];
  }
}

/**
 * Get proposals the DRep voted on in the current epoch (for streak tracking).
 */
export async function getVotedThisEpoch(drepId: string, currentEpoch: number): Promise<number> {
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from('drep_votes')
      .select('*', { count: 'exact', head: true })
      .eq('drep_id', drepId)
      .eq('epoch_no', currentEpoch);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

// ============================================================================
// SCORE HISTORY
// ============================================================================

export interface ScoreSnapshot {
  date: string;
  score: number;
  effectiveParticipation: number;
  rationaleRate: number;
  reliabilityScore: number;
  profileCompleteness: number;
}

/**
 * Get daily score history for a DRep, ordered oldest-first for charting.
 */
export async function getScoreHistory(drepId: string): Promise<ScoreSnapshot[]> {
  try {
    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from('drep_score_history')
      .select(
        'snapshot_date, score, effective_participation, rationale_rate, reliability_score, profile_completeness',
      )
      .eq('drep_id', drepId)
      .order('snapshot_date', { ascending: true });

    if (error || !rows) return [];

    return rows.map((r) => ({
      date: r.snapshot_date,
      score: r.score ?? 0,
      effectiveParticipation: r.effective_participation ?? 0,
      rationaleRate: r.rationale_rate ?? 0,
      reliabilityScore: r.reliability_score ?? 0,
      profileCompleteness: r.profile_completeness ?? 0,
    }));
  } catch (err) {
    logger.error('[Data] getScoreHistory error', { error: err });
    return [];
  }
}

/**
 * Get the percentile rank of a DRep's score among all DReps.
 * Returns 0-100 (e.g. 72 means "higher than 72% of DReps").
 */
export async function getDRepPercentile(score: number): Promise<number> {
  try {
    const supabase = createClient();

    const [{ count: belowCount }, { count: totalCount }] = await Promise.all([
      supabase
        .from('dreps')
        .select('*', { count: 'exact', head: true })
        .gt('score', 0)
        .lt('score', score),
      supabase.from('dreps').select('*', { count: 'exact', head: true }).gt('score', 0),
    ]);

    if (!totalCount || totalCount === 0) return 0;
    return Math.round(((belowCount ?? 0) / totalCount) * 100);
  } catch (err) {
    logger.error('[Data] getDRepPercentile error', { error: err });
    return 0;
  }
}

/**
 * Returns the 1-based rank of a DRep by score (1 = highest score).
 */
export async function getDRepRank(drepId: string): Promise<number | null> {
  try {
    const supabase = createClient();
    const { data: drep } = await supabase.from('dreps').select('score').eq('id', drepId).single();
    if (!drep?.score) return null;

    const { count } = await supabase
      .from('dreps')
      .select('*', { count: 'exact', head: true })
      .gt('score', drep.score);
    return (count ?? 0) + 1;
  } catch (err) {
    logger.error('[Data] getDRepRank error', { error: err });
    return null;
  }
}

/**
 * Returns epoch-by-epoch delegation power snapshots for a DRep.
 * Reads from drep_power_snapshots (populated by secondary sync with fresh Koios data)
 * rather than delegation_snapshots (which used stale DB counts).
 */
export async function getDRepDelegationTrend(
  drepId: string,
): Promise<{ epoch: number; votingPowerAda: number; delegatorCount: number }[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('drep_power_snapshots')
      .select('epoch_no, amount_lovelace, delegator_count')
      .eq('drep_id', drepId)
      .order('epoch_no', { ascending: true })
      .limit(30);
    return (data ?? []).map((s) => ({
      epoch: s.epoch_no,
      votingPowerAda: Math.round(Number(s.amount_lovelace) / 1_000_000),
      delegatorCount: s.delegator_count ?? 0,
    }));
  } catch (err) {
    logger.error('[Data] getDRepDelegationTrend error', { error: err });
    return [];
  }
}

// ============================================================================
// SOCIAL LINK CHECKS
// ============================================================================

export interface SocialLinkCheck {
  uri: string;
  status: 'valid' | 'broken' | 'pending';
  httpStatus: number | null;
  lastCheckedAt: string | null;
}

/**
 * Get social link check results for a DRep.
 */
export async function getSocialLinkChecks(drepId: string): Promise<SocialLinkCheck[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('social_link_checks')
      .select('uri, status, http_status, last_checked_at')
      .eq('drep_id', drepId);

    if (error || !data) return [];

    return data.map((r) => ({
      uri: r.uri,
      status: r.status as 'valid' | 'broken' | 'pending',
      httpStatus: r.http_status,
      lastCheckedAt: r.last_checked_at,
    }));
  } catch (err) {
    logger.error('[Data] getSocialLinkChecks error', { error: err });
    return [];
  }
}

// ============================================================================
// ENDORSEMENT COUNTS
// ============================================================================

/**
 * Fetch the total endorsement count for a DRep or SPO.
 * Checks precomputed aggregations first, falls back to direct count.
 */
export async function getEndorsementCount(
  entityType: 'drep' | 'spo',
  entityId: string,
): Promise<number> {
  try {
    const supabase = createClient();

    // Try precomputed aggregation first
    const { data: aggRow } = await supabase
      .from('engagement_signal_aggregations')
      .select('data')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('signal_type', 'endorsements')
      .order('epoch', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (aggRow?.data) {
      const data = aggRow.data as { total?: number };
      if (typeof data.total === 'number') return data.total;
    }

    // Fallback: direct count
    const { count } = await supabase
      .from('citizen_endorsements')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    return count ?? 0;
  } catch (err) {
    logger.error('[Data] getEndorsementCount error', { error: err });
    return 0;
  }
}

// ============================================================================
// CLAIM STATUS
// ============================================================================

// ============================================================================
// DELEGATOR INTELLIGENCE
// ============================================================================

export interface DelegatorSentiment {
  proposalTxHash: string;
  proposalIndex: number;
  title: string | null;
  support: number;
  oppose: number;
  abstain: number;
  total: number;
}

export interface DelegatorIntelligence {
  /** Top governance priorities of delegators (ranked) */
  topPriorities: { priority: string; count: number }[];
  /** Delegator sentiment on active/recent proposals */
  sentimentByProposal: DelegatorSentiment[];
  /** Average engagement level (0-100) — % of delegators who have cast at least one signal */
  avgEngagement: number;
  /** Total delegators who have submitted signals */
  engagedDelegators: number;
  /** Total delegators */
  totalDelegators: number;
}

/**
 * Aggregate delegator intelligence for a DRep: priorities, sentiment, engagement.
 * Pulls from citizen_priority_signals and citizen_sentiment tables
 * filtered to citizens delegated to this DRep.
 */
export async function getDelegatorIntelligence(drepId: string): Promise<DelegatorIntelligence> {
  const empty: DelegatorIntelligence = {
    topPriorities: [],
    sentimentByProposal: [],
    avgEngagement: 0,
    engagedDelegators: 0,
    totalDelegators: 0,
  };

  try {
    const supabase = createClient();

    // Fetch delegator count and sentiment in parallel (independent queries)
    const [drepRowResult, sentimentResult] = await Promise.all([
      supabase.from('dreps').select('info').eq('id', drepId).single(),
      supabase
        .from('citizen_sentiment')
        .select('proposal_tx_hash, proposal_index, sentiment, stake_address')
        .eq('delegated_drep_id', drepId),
    ]);

    const totalDelegators =
      ((drepRowResult.data?.info as Record<string, unknown>)?.delegatorCount as number) ?? 0;

    // Derive unique stake addresses from sentiment rows (no second query needed)
    const delegatorStakeAddresses = new Set(
      (sentimentResult.data ?? []).map((r) => r.stake_address).filter((s): s is string => !!s),
    );

    // Fetch priority signals for these delegators
    let topPriorities: { priority: string; count: number }[] = [];
    if (delegatorStakeAddresses.size > 0) {
      const stakeAddrs = [...delegatorStakeAddresses].slice(0, 500);
      const { data: priorityRows } = await supabase
        .from('citizen_priority_signals')
        .select('ranked_priorities')
        .in('stake_address', stakeAddrs);

      if (priorityRows && priorityRows.length > 0) {
        const priorityCounts = new Map<string, number>();
        for (const row of priorityRows) {
          const priorities = row.ranked_priorities ?? [];
          for (let i = 0; i < priorities.length; i++) {
            const p = priorities[i];
            // Weight by position: first = 3, second = 2, third+ = 1
            const weight = Math.max(1, 4 - i);
            priorityCounts.set(p, (priorityCounts.get(p) ?? 0) + weight);
          }
        }
        topPriorities = [...priorityCounts.entries()]
          .map(([priority, count]) => ({ priority, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
      }
    }

    // Aggregate sentiment by proposal
    const sentimentByProposal: DelegatorSentiment[] = [];
    const sentimentRows = sentimentResult.data ?? [];
    if (sentimentRows.length > 0) {
      const proposalSentimentMap = new Map<
        string,
        { txHash: string; index: number; support: number; oppose: number; abstain: number }
      >();

      for (const row of sentimentRows) {
        const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
        const existing = proposalSentimentMap.get(key) ?? {
          txHash: row.proposal_tx_hash,
          index: row.proposal_index,
          support: 0,
          oppose: 0,
          abstain: 0,
        };
        if (row.sentiment === 'support') existing.support++;
        else if (row.sentiment === 'oppose') existing.oppose++;
        else existing.abstain++;
        proposalSentimentMap.set(key, existing);
      }

      // Fetch proposal titles
      const txHashes = [...new Set([...proposalSentimentMap.values()].map((v) => v.txHash))];
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title')
        .in('tx_hash', txHashes);

      const titleMap = new Map<string, string>();
      for (const p of proposals ?? []) {
        titleMap.set(`${p.tx_hash}-${p.proposal_index}`, p.title);
      }

      for (const [key, agg] of proposalSentimentMap) {
        sentimentByProposal.push({
          proposalTxHash: agg.txHash,
          proposalIndex: agg.index,
          title: titleMap.get(key) ?? null,
          support: agg.support,
          oppose: agg.oppose,
          abstain: agg.abstain,
          total: agg.support + agg.oppose + agg.abstain,
        });
      }

      sentimentByProposal.sort((a, b) => b.total - a.total);
    }

    const engagedDelegators = delegatorStakeAddresses.size;
    const avgEngagement =
      totalDelegators > 0 ? Math.round((engagedDelegators / totalDelegators) * 100) : 0;

    return {
      topPriorities,
      sentimentByProposal: sentimentByProposal.slice(0, 10),
      avgEngagement,
      engagedDelegators,
      totalDelegators,
    };
  } catch (err) {
    logger.error('[Data] getDelegatorIntelligence error', { error: err });
    return empty;
  }
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  drepId: string;
  name: string;
  score: number;
  sizeTier: string;
  participation: number;
  rationale: number;
  endorsements: number;
  trend: number;
}

/**
 * Get a ranked leaderboard of DReps sorted by score.
 * Used by the governance/leaderboard page.
 */
export async function getLeaderboard(
  limit = 20,
  sortBy: 'score' | 'participation' | 'rationale' | 'endorsements' = 'score',
): Promise<LeaderboardEntry[]> {
  try {
    const supabase = createClient();

    const orderCol =
      sortBy === 'participation'
        ? 'effective_participation'
        : sortBy === 'rationale'
          ? 'rationale_rate'
          : 'score';

    const { data, error } = await supabase
      .from('dreps')
      .select(
        'id, score, size_tier, info, effective_participation, rationale_rate, reliability_score',
      )
      .not('info->isActive', 'eq', false)
      .order(orderCol, { ascending: false })
      .limit(Math.min(50, limit));

    if (error || !data) return [];

    return data.map((d, i) => {
      const info = (d.info ?? {}) as Record<string, unknown>;
      return {
        rank: i + 1,
        drepId: d.id,
        name:
          (info.name as string) ||
          (info.ticker as string) ||
          (info.handle as string) ||
          d.id.slice(0, 16),
        score: d.score ?? 0,
        sizeTier: d.size_tier ?? 'Unknown',
        participation: d.effective_participation ?? 0,
        rationale: d.rationale_rate ?? 0,
        endorsements: 0, // populated separately if needed
        trend: 0,
      };
    });
  } catch (err) {
    logger.error('[Data] getLeaderboard error', { error: err });
    return [];
  }
}

/**
 * Check if a DRep has been claimed by any user.
 */
export async function isDRepClaimed(drepId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('claimed_drep_id', drepId)
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// AI Character Profiles
// ---------------------------------------------------------------------------

export interface CharacterOutput {
  title: string;
  summary: string;
  pills: Array<{ label: string; reason: string }>;
}

/**
 * Get the latest AI-generated character profile for a DRep.
 * Returns the most recent epoch's character, or null if none exists.
 */
export async function getDRepCharacter(drepId: string): Promise<CharacterOutput | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('drep_characters')
      .select('character_title, character_summary, attribute_pills')
      .eq('drep_id', drepId)
      .order('epoch', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      title: data.character_title,
      summary: data.character_summary,
      pills: (data.attribute_pills as Array<{ label: string; reason: string }>) ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Get the latest AI-generated character profile for an SPO.
 * Returns the most recent epoch's character, or null if none exists.
 */
export async function getSPOCharacter(poolId: string): Promise<CharacterOutput | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('spo_characters')
      .select('character_title, character_summary, attribute_pills')
      .eq('pool_id', poolId)
      .order('epoch', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      title: data.character_title,
      summary: data.character_summary,
      pills: (data.attribute_pills as Array<{ label: string; reason: string }>) ?? [],
    };
  } catch {
    return null;
  }
}

// Citizen sentiment aggregate (server-side, for editorial headline)
// ---------------------------------------------------------------------------

export async function getCitizenSentimentSummary(
  txHash: string,
  proposalIndex: number,
): Promise<{ support: number; oppose: number; unsure: number; total: number } | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('citizen_sentiment')
      .select('sentiment')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex);

    if (error || !data || data.length === 0) return null;

    const counts = { support: 0, oppose: 0, unsure: 0, total: data.length };
    for (const row of data) {
      const s = row.sentiment as string;
      if (s === 'support') counts.support++;
      else if (s === 'oppose') counts.oppose++;
      else counts.unsure++;
    }
    return counts;
  } catch {
    return null;
  }
}
