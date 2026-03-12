/**
 * Data Layer - Supabase Cache with Koios Fallback
 * Fast reads from Supabase with automatic freshness checks and sync triggering
 */

import { createClient } from './supabase';
import { getEnrichedDReps, EnrichedDRep } from './koios';
import { isWellDocumented } from '@/utils/documentation';
import { logger } from '@/lib/logger';
import type { SizeTier } from '@/utils/scoring';

const CACHE_FRESHNESS_MINUTES = 15;

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

/**
 * Trigger background sync without blocking.
 * In production, fires an Inngest event to retrigger the DReps sync.
 * Debounced to avoid spamming events on every stale read.
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
 * Get all DReps with caching and fallback
 * Returns same structure as getEnrichedDReps() for drop-in replacement
 */
export async function getAllDReps(): Promise<{
  dreps: EnrichedDRep[];
  allDReps: EnrichedDRep[];
  error: boolean;
  totalAvailable: number;
}> {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    if (isDev) {
      logger.info('[Data] Querying Supabase cache...');
    }

    const supabase = createClient();

    // Query all DReps ordered by score (paginate to bypass PostgREST 1000-row default)
    const { data: page1, error: supabaseError } = await supabase
      .from('dreps')
      .select('*')
      .order('score', { ascending: false })
      .range(0, 999)
      .abortSignal(AbortSignal.timeout(10_000));

    if (supabaseError) {
      logger.error('[Data] Supabase query failed', { error: supabaseError.message });
      throw new Error('Supabase unavailable');
    }

    let rows = page1 || [];
    if (rows.length === 1000) {
      const { data: page2 } = await supabase
        .from('dreps')
        .select('*')
        .order('score', { ascending: false })
        .range(1000, 1999)
        .abortSignal(AbortSignal.timeout(10_000));
      if (page2?.length) rows = [...rows, ...page2];
    }

    // Check if we have data
    if (!rows || rows.length === 0) {
      logger.warn('[Data] No data in Supabase, falling back to Koios');
      logger.warn('[Data] Run: npm run sync');
      return await getEnrichedDReps(false);
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
      const freshnessThreshold = new Date(Date.now() - CACHE_FRESHNESS_MINUTES * 60 * 1000);
      const isStale = maxUpdatedAt < freshnessThreshold;

      if (isStale) {
        const ageMinutes = Math.round((Date.now() - maxTimestamp) / 1000 / 60);
        if (isDev) {
          logger.info('[Data] Cache is stale', { ageMinutes });
        }
        // Trigger sync in background (non-blocking)
        triggerBackgroundSync();
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

    return {
      dreps: wellDocumentedDReps,
      allDReps: allDReps,
      error: false,
      totalAvailable: allDReps.length,
    };
  } catch (error: unknown) {
    logger.error('[Data] Cache read failed, falling back to Koios', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to direct Koios fetch
    if (isDev) {
      logger.info('[Data] Fetching directly from Koios (slow)...');
    }

    return await getEnrichedDReps(false);
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
    const SHELLEY_GENESIS = 1596491091;
    const EPOCH_LEN = 432000;
    const SHELLEY_BASE = 209;
    const currentEpoch =
      Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;

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
      return 88; // fallback based on known count
    }

    return count && count > 0 ? count : 88;
  } catch (err) {
    logger.error('[Data] getActualProposalCount error', { error: err });
    return 88;
  }
}

/**
 * Proposal metadata from the cached proposals table
 */
export interface CachedProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  abstract: string | null;
  aiSummary: string | null;
  proposalType: string | null;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  relevantPrefs: string[];
}

/**
 * Get proposals by their IDs (tx_hash + proposal_index)
 * Used to enrich vote records with proposal metadata
 */
export async function getProposalsByIds(
  proposalIds: { txHash: string; index: number }[],
): Promise<Map<string, CachedProposal>> {
  const result = new Map<string, CachedProposal>();

  if (proposalIds.length === 0) return result;

  try {
    const supabase = createClient();

    // Build a filter for all the proposal IDs
    // Note: Supabase doesn't support compound key IN queries easily,
    // so we'll fetch all proposals and filter client-side for simplicity
    const txHashes = [...new Set(proposalIds.map((p) => p.txHash))];

    const { data: rows, error } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, withdrawal_amount, treasury_tier, relevant_prefs',
      )
      .in('tx_hash', txHashes);

    if (error) {
      logger.warn('[Data] getProposalsByIds query failed', { error: error.message });
      return result;
    }

    if (!rows || rows.length === 0) {
      logger.warn('[Data] getProposalsByIds: no proposals found', { txHashCount: txHashes.length });
      return result;
    }

    // Supabase doesn't support compound-key IN queries; we filter client-side after fetching by tx_hash
    const requestedIds = new Set(proposalIds.map((p) => `${p.txHash}-${p.index}`));

    for (const row of rows) {
      const key = `${row.tx_hash}-${row.proposal_index}`;
      if (requestedIds.has(key)) {
        result.set(key, {
          txHash: row.tx_hash,
          proposalIndex: row.proposal_index,
          title: row.title,
          abstract: row.abstract,
          aiSummary: row.ai_summary || null,
          proposalType: row.proposal_type,
          withdrawalAmount: row.withdrawal_amount != null ? Number(row.withdrawal_amount) : null,
          treasuryTier: row.treasury_tier,
          relevantPrefs: row.relevant_prefs || [],
        });
      }
    }

    return result;
  } catch (err) {
    logger.error('[Data] getProposalsByIds error', { error: err });
    return result;
  }
}

export interface RationaleRecord {
  rationaleText: string | null;
  rationaleAiSummary: string | null;
  hashVerified: boolean | null;
}

/**
 * Get cached rationale text and AI summary for votes by their tx hashes
 */
export async function getRationalesByVoteTxHashes(
  voteTxHashes: string[],
): Promise<Map<string, RationaleRecord>> {
  const result = new Map<string, RationaleRecord>();

  if (voteTxHashes.length === 0) return result;

  try {
    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from('vote_rationales')
      .select('vote_tx_hash, rationale_text, ai_summary, hash_verified')
      .in('vote_tx_hash', voteTxHashes);

    if (error) {
      logger.warn('[Data] getRationalesByVoteTxHashes query failed', { error: error.message });
      return result;
    }

    if (!rows) return result;

    for (const row of rows) {
      result.set(row.vote_tx_hash, {
        rationaleText: row.rationale_text || null,
        rationaleAiSummary: row.ai_summary || null,
        hashVerified: row.hash_verified ?? null,
      });
    }

    return result;
  } catch (err) {
    logger.error('[Data] getRationalesByVoteTxHashes error', { error: err });
    return result;
  }
}

/**
 * Row shape returned from the drep_votes table
 */
export interface DRepVoteRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: 'Yes' | 'No' | 'Abstain';
  epoch_no: number | null;
  block_time: number;
  meta_url: string | null;
  meta_hash: string | null;
}

/**
 * Get all votes for a specific DRep from Supabase
 * Ordered by block_time DESC (most recent first)
 */
export async function getVotesByDRepId(drepId: string): Promise<DRepVoteRow[]> {
  try {
    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from('drep_votes')
      .select('*')
      .eq('drep_id', drepId)
      .order('block_time', { ascending: false });

    if (error) {
      logger.warn('[Data] getVotesByDRepId query failed', { error: error.message });
      return [];
    }

    return (rows as DRepVoteRow[]) || [];
  } catch (err) {
    logger.error('[Data] getVotesByDRepId error', { error: err });
    return [];
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

export interface TriBodyVotes {
  drep: { yes: number; no: number; abstain: number };
  spo: { yes: number; no: number; abstain: number };
  cc: { yes: number; no: number; abstain: number };
}

export interface ProposalWithVoteSummary {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  abstract: string | null;
  proposalType: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  relevantPrefs: string[];
  proposedEpoch: number | null;
  blockTime: number | null;
  aiSummary: string | null;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalVotes: number;
  voterDrepIds: string[];
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
  expirationEpoch: number | null;
  triBody?: TriBodyVotes;
  paramChanges: Record<string, unknown> | null;
}

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

    // Fetch vote counts + voter DRep IDs grouped by proposal
    const [voteCountsResult, votingSummaryResult] = await Promise.all([
      supabase.from('drep_votes').select('proposal_tx_hash, proposal_index, vote, drep_id'),
      supabase
        .from('proposal_voting_summary')
        .select(
          'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
        ),
    ]);

    const { data: voteCounts, error: vError } = voteCountsResult;
    if (vError) {
      logger.warn('[Data] vote counts query failed', { error: vError.message });
    }

    // Build tri-body map from proposal_voting_summary
    const triBodyMap = new Map<string, TriBodyVotes>();
    if (votingSummaryResult.data) {
      for (const s of votingSummaryResult.data) {
        const key = `${s.proposal_tx_hash}-${s.proposal_index}`;
        triBodyMap.set(key, {
          drep: {
            yes: s.drep_yes_votes_cast || 0,
            no: s.drep_no_votes_cast || 0,
            abstain: s.drep_abstain_votes_cast || 0,
          },
          spo: {
            yes: s.pool_yes_votes_cast || 0,
            no: s.pool_no_votes_cast || 0,
            abstain: s.pool_abstain_votes_cast || 0,
          },
          cc: {
            yes: s.committee_yes_votes_cast || 0,
            no: s.committee_no_votes_cast || 0,
            abstain: s.committee_abstain_votes_cast || 0,
          },
        });
      }
    }

    // Aggregate vote counts + voter DRep IDs per proposal
    const countMap = new Map<
      string,
      { yes: number; no: number; abstain: number; drepIds: Set<string> }
    >();
    if (voteCounts) {
      for (const v of voteCounts) {
        const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
        const entry = countMap.get(key) || {
          yes: 0,
          no: 0,
          abstain: 0,
          drepIds: new Set<string>(),
        };
        if (v.vote === 'Yes') entry.yes++;
        else if (v.vote === 'No') entry.no++;
        else entry.abstain++;
        if (v.drep_id) entry.drepIds.add(v.drep_id);
        countMap.set(key, entry);
      }
    }

    return proposals.map((p) => {
      const key = `${p.tx_hash}-${p.proposal_index}`;
      const counts = countMap.get(key) || { yes: 0, no: 0, abstain: 0, drepIds: new Set<string>() };
      return {
        txHash: p.tx_hash,
        proposalIndex: p.proposal_index,
        title: p.title,
        abstract: p.abstract,
        proposalType: p.proposal_type,
        withdrawalAmount: p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null,
        treasuryTier: p.treasury_tier,
        relevantPrefs: p.relevant_prefs || [],
        proposedEpoch: p.proposed_epoch,
        blockTime: p.block_time,
        aiSummary: p.ai_summary || null,
        yesCount: counts.yes,
        noCount: counts.no,
        abstainCount: counts.abstain,
        totalVotes: counts.yes + counts.no + counts.abstain,
        voterDrepIds: [...counts.drepIds],
        ratifiedEpoch: p.ratified_epoch ?? null,
        enactedEpoch: p.enacted_epoch ?? null,
        droppedEpoch: p.dropped_epoch ?? null,
        expiredEpoch: p.expired_epoch ?? null,
        expirationEpoch: p.expiration_epoch ?? null,
        triBody: triBodyMap.get(key),
        paramChanges: (p.param_changes as Record<string, unknown>) ?? null,
      };
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
      supabase
        .from('proposal_voting_summary')
        .select(
          'drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
        )
        .eq('proposal_tx_hash', txHash)
        .eq('proposal_index', proposalIndex)
        .single(),
    ]);

    const { data: row, error } = proposalResult;
    if (error || !row) return null;

    const votes = votesResult.data;
    let yes = 0,
      no = 0,
      abstain = 0;
    const drepIds = new Set<string>();
    if (votes) {
      for (const v of votes) {
        if (v.vote === 'Yes') yes++;
        else if (v.vote === 'No') no++;
        else abstain++;
        if (v.drep_id) drepIds.add(v.drep_id);
      }
    }

    const s = summaryResult.data;
    const triBody: TriBodyVotes | undefined = s
      ? {
          drep: {
            yes: s.drep_yes_votes_cast || 0,
            no: s.drep_no_votes_cast || 0,
            abstain: s.drep_abstain_votes_cast || 0,
          },
          spo: {
            yes: s.pool_yes_votes_cast || 0,
            no: s.pool_no_votes_cast || 0,
            abstain: s.pool_abstain_votes_cast || 0,
          },
          cc: {
            yes: s.committee_yes_votes_cast || 0,
            no: s.committee_no_votes_cast || 0,
            abstain: s.committee_abstain_votes_cast || 0,
          },
        }
      : undefined;

    return {
      txHash: row.tx_hash,
      proposalIndex: row.proposal_index,
      title: row.title,
      abstract: row.abstract,
      proposalType: row.proposal_type,
      withdrawalAmount: row.withdrawal_amount != null ? Number(row.withdrawal_amount) : null,
      treasuryTier: row.treasury_tier,
      relevantPrefs: row.relevant_prefs || [],
      proposedEpoch: row.proposed_epoch,
      blockTime: row.block_time,
      aiSummary: row.ai_summary || null,
      yesCount: yes,
      noCount: no,
      abstainCount: abstain,
      totalVotes: yes + no + abstain,
      voterDrepIds: [...drepIds],
      ratifiedEpoch: row.ratified_epoch ?? null,
      enactedEpoch: row.enacted_epoch ?? null,
      droppedEpoch: row.dropped_epoch ?? null,
      expiredEpoch: row.expired_epoch ?? null,
      expirationEpoch: row.expiration_epoch ?? null,
      triBody,
      paramChanges: (row.param_changes as Record<string, unknown>) ?? null,
    };
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
      .select('vote_tx_hash, drep_id, vote, block_time, meta_url')
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
// SPO & CC VOTES
// ============================================================================

export interface SpoVoteDetail {
  poolId: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
}

export interface CcVoteDetail {
  ccHotId: string;
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
      .select('cc_hot_id, vote, block_time')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .order('block_time', { ascending: false });

    if (error || !data) return [];
    return data.map((v) => ({
      ccHotId: v.cc_hot_id,
      vote: v.vote as 'Yes' | 'No' | 'Abstain',
      blockTime: v.block_time,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// CC TRANSPARENCY INDEX
// ============================================================================

export interface CCTransparencySnapshot {
  epochNo: number;
  transparencyIndex: number;
  participationScore: number;
  rationaleQualityScore: number;
  responsivenessScore: number;
  independenceScore: number;
  communityEngagementScore: number;
  votesCast: number;
  eligibleProposals: number;
}

export async function getCCTransparencyHistory(ccHotId: string): Promise<CCTransparencySnapshot[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cc_transparency_snapshots')
      .select('*')
      .eq('cc_hot_id', ccHotId)
      .order('epoch_no', { ascending: true });

    if (error || !data) return [];
    return data.map((s) => ({
      epochNo: s.epoch_no,
      transparencyIndex: s.transparency_index ?? 0,
      participationScore: s.participation_score ?? 0,
      rationaleQualityScore: s.rationale_quality_score ?? 0,
      responsivenessScore: s.responsiveness_score ?? 0,
      independenceScore: s.independence_score ?? 0,
      communityEngagementScore: s.community_engagement_score ?? 0,
      votesCast: s.votes_cast ?? 0,
      eligibleProposals: s.eligible_proposals ?? 0,
    }));
  } catch {
    return [];
  }
}

export interface CCMemberTransparency {
  ccHotId: string;
  authorName: string | null;
  status: string | null;
  expirationEpoch: number | null;
  transparencyIndex: number | null;
  transparencyGrade: string | null;
  participationScore: number | null;
  rationaleQualityScore: number | null;
  responsivenessScore: number | null;
  independenceScore: number | null;
  communityEngagementScore: number | null;
  fidelityScore: number | null;
  rationaleProvisionRate: number | null;
  avgArticleCoverage: number | null;
  avgReasoningQuality: number | null;
  consistencyScore: number | null;
  votesCast: number | null;
  eligibleProposals: number | null;
}

export async function getCCMembersTransparency(): Promise<CCMemberTransparency[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cc_members')
      .select(
        'cc_hot_id, author_name, status, expiration_epoch, transparency_index, transparency_grade, participation_score, rationale_quality_score, independence_score, community_engagement_score, responsiveness_score, fidelity_score, rationale_provision_rate, avg_article_coverage, avg_reasoning_quality, consistency_score, votes_cast, eligible_proposals',
      )
      .order('transparency_index', { ascending: false, nullsFirst: false });

    if (error || !data) return [];
    return data.map((m) => ({
      ccHotId: m.cc_hot_id,
      authorName: m.author_name,
      status: m.status,
      expirationEpoch: m.expiration_epoch,
      transparencyIndex: m.transparency_index,
      transparencyGrade: m.transparency_grade,
      participationScore: m.participation_score,
      rationaleQualityScore: m.rationale_quality_score,
      responsivenessScore: m.responsiveness_score,
      independenceScore: m.independence_score,
      communityEngagementScore: m.community_engagement_score,
      fidelityScore: m.fidelity_score,
      rationaleProvisionRate: m.rationale_provision_rate,
      avgArticleCoverage: m.avg_article_coverage,
      avgReasoningQuality: m.avg_reasoning_quality,
      consistencyScore: m.consistency_score,
      votesCast: m.votes_cast,
      eligibleProposals: m.eligible_proposals,
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
  avgTransparency: number | null;
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
      getCCMembersTransparency(),
      supabase
        .from('inter_body_alignment')
        .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct'),
      supabase.from('cc_votes').select('cc_hot_id, proposal_tx_hash, proposal_index, vote'),
      supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
    ]);

    const currentEpoch = stats?.current_epoch ?? 0;
    const activeMembers = members.filter((m) => m.status === 'authorized').length;
    const totalMembers = activeMembers; // Only count active members — expired ones are historical
    const scoredMembers = members.filter((m) => m.transparencyIndex != null);
    const avgTransparency =
      scoredMembers.length > 0
        ? Math.round(
            scoredMembers.reduce((sum, m) => sum + (m.transparencyIndex ?? 0), 0) /
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
      voteMap.set(v.cc_hot_id, v.vote);
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
        .from('cc_transparency_snapshots')
        .select('transparency_index')
        .eq('epoch_no', currentEpoch - 3);

      if (oldSnapshots && oldSnapshots.length > 0) {
        const oldAvg = Math.round(
          oldSnapshots.reduce((s, r) => s + (r.transparency_index ?? 0), 0) / oldSnapshots.length,
        );
        const delta = (avgTransparency ?? 0) - oldAvg;
        if (delta > 2) trend = 'improving';
        else if (delta < -2) trend = 'declining';
      }
    }

    const healthData = { activeMembers, totalMembers, avgTransparency, tensionCount, trend };
    const status = interpretHealthStatus(healthData);
    const narrative = generateCCHealthNarrative(healthData);

    return { status, narrative, trend, activeMembers, totalMembers, avgTransparency, tensionCount };
  } catch {
    return {
      status: 'attention',
      narrative: 'Unable to compute CC health summary.',
      trend: 'stable',
      activeMembers: 0,
      totalMembers: 0,
      avgTransparency: null,
      tensionCount: 0,
    };
  }
}

export async function getCCMemberVerdicts(): Promise<CCMemberVerdict[]> {
  const { generateMemberVerdict, interpretTrend } = await import('@/lib/cc/interpretations');

  try {
    const supabase = createClient();
    const members = await getCCMembersTransparency();
    if (members.length === 0) return [];

    // Get latest 2 snapshots per member for trend
    const { data: snapshots } = await supabase
      .from('cc_transparency_snapshots')
      .select('cc_hot_id, epoch_no, transparency_index')
      .order('epoch_no', { ascending: false })
      .limit(members.length * 5);

    const snapshotsByMember = new Map<string, { epoch: number; index: number }[]>();
    for (const s of snapshots ?? []) {
      const list = snapshotsByMember.get(s.cc_hot_id) ?? [];
      list.push({ epoch: s.epoch_no, index: s.transparency_index ?? 0 });
      snapshotsByMember.set(s.cc_hot_id, list);
    }

    const PILLAR_LABELS: Record<string, string> = {
      participation: 'Participation',
      rationaleQuality: 'Rationale Quality',
      responsiveness: 'Responsiveness',
      independence: 'Independence',
    };

    return members.map((m, i) => {
      const rank = i + 1;
      const total = members.length;

      // Find strongest/weakest pillar
      const pillars: [string, number | null][] = [
        ['participation', m.participationScore],
        ['rationaleQuality', m.rationaleQualityScore],
        ['responsiveness', m.responsivenessScore],
        ['independence', m.independenceScore],
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
        transparencyScore: m.transparencyIndex,
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

    // Fetch open proposals
    const { data: proposals, error: pError } = await supabase
      .from('proposals')
      .select('*')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('block_time', { ascending: false });

    if (pError || !proposals || proposals.length === 0) return [];

    // Fetch this DRep's votes to determine which proposals are already voted on
    const { data: drepVotes, error: vError } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index')
      .eq('drep_id', drepId);

    const votedKeys = new Set<string>();
    if (!vError && drepVotes) {
      for (const v of drepVotes) {
        votedKeys.add(`${v.proposal_tx_hash}-${v.proposal_index}`);
      }
    }

    // Fetch vote counts for open proposals
    const openTxHashes = proposals.map((p) => p.tx_hash);
    const { data: allVotes } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index, vote')
      .in('proposal_tx_hash', openTxHashes);

    const countMap = new Map<string, { yes: number; no: number; abstain: number }>();
    if (allVotes) {
      for (const v of allVotes) {
        const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
        const entry = countMap.get(key) || { yes: 0, no: 0, abstain: 0 };
        if (v.vote === 'Yes') entry.yes++;
        else if (v.vote === 'No') entry.no++;
        else entry.abstain++;
        countMap.set(key, entry);
      }
    }

    // Filter to proposals the DRep hasn't voted on
    return proposals
      .filter((p) => !votedKeys.has(`${p.tx_hash}-${p.proposal_index}`))
      .map((p) => {
        const key = `${p.tx_hash}-${p.proposal_index}`;
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
      supabase.from('dreps').select('*', { count: 'exact', head: true }).lt('score', score),
      supabase.from('dreps').select('*', { count: 'exact', head: true }),
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
 */
export async function getDRepDelegationTrend(
  drepId: string,
): Promise<{ epoch: number; votingPowerAda: number; delegatorCount: number }[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('delegation_snapshots')
      .select('epoch, total_power_lovelace, delegator_count')
      .eq('drep_id', drepId)
      .order('epoch', { ascending: true })
      .limit(30);
    return (data ?? []).map((s) => ({
      epoch: s.epoch,
      votingPowerAda: Math.round(Number(s.total_power_lovelace) / 1_000_000),
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
// VOTING POWER & THRESHOLD HELPERS
// ============================================================================

export interface VotingPowerSummary {
  yesPower: number;
  noPower: number;
  abstainPower: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalActivePower: number;
  threshold: number | null;
  thresholdLabel: string | null;
}

const PROPOSAL_TYPE_THRESHOLD_MAP: Record<string, string> = {
  TreasuryWithdrawals: 'dvt_treasury_withdrawal',
  ParameterChange: 'dvt_p_p_network_group',
  HardForkInitiation: 'dvt_hard_fork_initiation',
  NewConstitution: 'dvt_update_to_constitution',
  UpdateConstitution: 'dvt_update_to_constitution',
  NoConfidence: 'dvt_motion_no_confidence',
  NewCommittee: 'dvt_committee_normal',
  NewConstitutionalCommittee: 'dvt_committee_normal',
};

let cachedThresholds: { data: Record<string, number>; fetchedAt: number } | null = null;
const THRESHOLD_CACHE_MS = 24 * 60 * 60 * 1000;

async function getGovernanceThresholds(): Promise<Record<string, number> | null> {
  if (cachedThresholds && Date.now() - cachedThresholds.fetchedAt < THRESHOLD_CACHE_MS) {
    return cachedThresholds.data;
  }
  const { fetchGovernanceThresholds } = await import('@/utils/koios');
  const data = await fetchGovernanceThresholds();
  if (data) {
    cachedThresholds = { data, fetchedAt: Date.now() };
  }
  return data;
}

export async function getVotingPowerSummary(
  txHash: string,
  proposalIndex: number,
  proposalType: string,
): Promise<VotingPowerSummary> {
  const supabase = createClient();

  // Prefer canonical proposal_voting_summary (from Koios /proposal_voting_summary)
  const { data: canonical } = await supabase
    .from('proposal_voting_summary')
    .select('*')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .single();

  const thresholdKey = PROPOSAL_TYPE_THRESHOLD_MAP[proposalType];
  let threshold: number | null = null;
  let thresholdLabel: string | null = null;

  if (thresholdKey) {
    const params = await getGovernanceThresholds();
    if (params && params[thresholdKey] != null) {
      threshold = params[thresholdKey];
      thresholdLabel = `${Math.round(threshold * 100)}% of active DRep stake needed`;
    }
  }

  if (canonical) {
    const yesPower = Number(canonical.drep_yes_vote_power) || 0;
    const noPower = Number(canonical.drep_no_vote_power) || 0;
    const abstainPower = Number(canonical.drep_abstain_vote_power) || 0;
    const alwaysAbstain = Number(canonical.drep_always_abstain_power) || 0;
    const totalActivePower = yesPower + noPower + abstainPower + alwaysAbstain;

    return {
      yesPower,
      noPower,
      abstainPower,
      yesCount: canonical.drep_yes_votes_cast || 0,
      noCount: canonical.drep_no_votes_cast || 0,
      abstainCount: canonical.drep_abstain_votes_cast || 0,
      totalActivePower,
      threshold,
      thresholdLabel,
    };
  }

  // Fallback: sum from per-vote data (less accurate, missing system auto-DReps)
  // Run drep_votes and dreps in parallel (independent queries)
  const [votesResult, activeDrepsResult] = await Promise.all([
    supabase
      .from('drep_votes')
      .select('vote, voting_power_lovelace')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .not('voting_power_lovelace', 'is', null),
    supabase.from('dreps').select('info').eq('info->>isActive', 'true'),
  ]);

  const votes = votesResult.data;
  const activeDreps = activeDrepsResult.data;

  let yesPower = 0,
    noPower = 0,
    abstainPower = 0;
  let yesCount = 0,
    noCount = 0,
    abstainCount = 0;

  if (votes) {
    for (const v of votes) {
      const power = Number(v.voting_power_lovelace) || 0;
      if (v.vote === 'Yes') {
        yesPower += power;
        yesCount++;
      } else if (v.vote === 'No') {
        noPower += power;
        noCount++;
      } else {
        abstainPower += power;
        abstainCount++;
      }
    }
  }

  let totalActivePower = 0;
  if (activeDreps) {
    for (const d of activeDreps) {
      const info = d.info as Record<string, unknown> | null;
      totalActivePower += parseInt(String(info?.votingPowerLovelace || '0'), 10) || 0;
    }
  }

  return {
    yesPower,
    noPower,
    abstainPower,
    yesCount,
    noCount,
    abstainCount,
    totalActivePower,
    threshold,
    thresholdLabel,
  };
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
