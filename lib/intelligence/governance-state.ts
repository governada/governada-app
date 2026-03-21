/**
 * Governance State Composite — consolidated governance + user state.
 *
 * Aggregates urgency, temperature, epoch context, and per-user state into
 * a single response. Powers: Governance Pulse dot, temporal mode detection,
 * Co-Pilot readiness signal, Hub card ordering.
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Epoch derivation constants (shared with lib/data.ts and lib/api/response.ts)
// ---------------------------------------------------------------------------

const SHELLEY_GENESIS = 1596491091;
const EPOCH_LEN = 432000; // 5 days in seconds
const SHELLEY_BASE = 209;

function getCurrentEpoch(): number {
  return Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;
}

function getEpochProgress(): { progress: number; remainingSeconds: number; epochStart: number } {
  const now = Date.now() / 1000;
  const epochStart = (getCurrentEpoch() - SHELLEY_BASE) * EPOCH_LEN + SHELLEY_GENESIS;
  const elapsed = now - epochStart;
  const progress = Math.min(1, Math.max(0, elapsed / EPOCH_LEN));
  const remainingSeconds = Math.max(0, EPOCH_LEN - elapsed);
  return { progress, remainingSeconds, epochStart };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GovernanceStateResult {
  urgency: number; // 0-100
  temperature: number; // 0-100
  epoch: EpochContext;
  userState: UserGovernanceState | null;
  computedAt: string;
}

export interface EpochContext {
  currentEpoch: number;
  progress: number; // 0-1
  remainingSeconds: number;
  activeProposalCount: number;
}

export interface UserGovernanceState {
  /** DRep ID the user is delegated to (null if not delegated) */
  delegatedDrepId: string | null;
  /** Number of unvoted active proposals (for DReps) */
  pendingVotes: number;
  /** Whether the user has any pending actions */
  hasPendingActions: boolean;
  /** DRep score if user is a DRep */
  drepScore: number | null;
  /** DRep rank if user is a DRep */
  drepRank: number | null;
}

// ---------------------------------------------------------------------------
// In-memory cache (shared across requests in the same process)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const GLOBAL_CACHE_TTL_MS = 60_000; // 60s for non-user data
const USER_CACHE_TTL_MS = 120_000; // 2min for user-specific data

let globalCache: CacheEntry<Omit<GovernanceStateResult, 'userState'>> | null = null;
const userCache = new Map<string, CacheEntry<UserGovernanceState>>();

// Cap user cache size
const USER_CACHE_MAX = 500;

function evictUserCache() {
  if (userCache.size <= USER_CACHE_MAX) return;
  const oldest = [...userCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
  for (let i = 0; i < 100 && i < oldest.length; i++) {
    userCache.delete(oldest[i][0]);
  }
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Compute the consolidated governance state.
 *
 * @param stakeAddress - Optional user stake address for user-specific state
 */
export async function computeGovernanceState(
  stakeAddress?: string,
): Promise<GovernanceStateResult> {
  const now = Date.now();

  // Try global cache first
  let globalData: Omit<GovernanceStateResult, 'userState'>;
  if (globalCache && now - globalCache.timestamp < GLOBAL_CACHE_TTL_MS) {
    globalData = globalCache.data;
  } else {
    globalData = await computeGlobalState();
    globalCache = { data: globalData, timestamp: now };
  }

  // User state (if authenticated)
  let userState: UserGovernanceState | null = null;
  if (stakeAddress) {
    const cached = userCache.get(stakeAddress);
    if (cached && now - cached.timestamp < USER_CACHE_TTL_MS) {
      userState = cached.data;
    } else {
      userState = await computeUserState(stakeAddress, globalData.epoch.currentEpoch);
      userCache.set(stakeAddress, { data: userState, timestamp: now });
      evictUserCache();
    }
  }

  return { ...globalData, userState };
}

async function computeGlobalState(): Promise<Omit<GovernanceStateResult, 'userState'>> {
  const supabase = createClient();
  const { progress, remainingSeconds } = getEpochProgress();
  const currentEpoch = getCurrentEpoch();

  // Parallel queries for urgency and temperature inputs
  const [openProposalsResult, recentProposalsResult, govStatsResult] = await Promise.all([
    // Active proposals (not ratified/enacted/dropped/expired)
    supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, expiration_epoch, proposed_epoch, block_time, withdrawal_amount',
        {
          count: 'exact',
        },
      )
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
    // Proposals in the last 3 epochs (for temperature rolling average)
    supabase
      .from('proposals')
      .select('proposed_epoch', { count: 'exact' })
      .gte('proposed_epoch', currentEpoch - 3),
    // Governance stats
    supabase.from('governance_stats').select('*').eq('id', 1).single(),
  ]);

  const activeProposals = openProposalsResult.data ?? [];
  const activeProposalCount = openProposalsResult.count ?? activeProposals.length;
  const recentProposalCount = recentProposalsResult.count ?? 0;

  // --- Urgency (0-100) ---
  // Factors: proposals expiring soon + epoch proximity
  const urgency = computeUrgency(activeProposals, currentEpoch, progress);

  // --- Temperature (0-100) ---
  // Factors: proposal volume vs rolling average + participation rate
  const temperature = computeTemperature(
    activeProposalCount,
    recentProposalCount,
    govStatsResult.data,
  );

  return {
    urgency,
    temperature,
    epoch: {
      currentEpoch,
      progress,
      remainingSeconds,
      activeProposalCount,
    },
    computedAt: new Date().toISOString(),
  };
}

function computeUrgency(
  activeProposals: Array<{
    tx_hash: string;
    proposal_index: number;
    expiration_epoch: number | null;
    proposed_epoch: number | null;
    block_time: number | null;
    withdrawal_amount: string | number | null;
  }>,
  currentEpoch: number,
  epochProgress: number,
): number {
  if (activeProposals.length === 0) return 0;

  let urgencyScore = 0;

  // Factor 1: Proposals expiring within 1 epoch (high urgency)
  const expiringNow = activeProposals.filter(
    (p) => p.expiration_epoch != null && p.expiration_epoch <= currentEpoch + 1,
  );
  urgencyScore += Math.min(50, expiringNow.length * 15);

  // Factor 2: Proposals expiring within 2 epochs (medium urgency)
  const expiringSoon = activeProposals.filter(
    (p) =>
      p.expiration_epoch != null &&
      p.expiration_epoch > currentEpoch + 1 &&
      p.expiration_epoch <= currentEpoch + 2,
  );
  urgencyScore += Math.min(20, expiringSoon.length * 5);

  // Factor 3: Epoch proximity (last 20% of epoch = higher urgency)
  if (epochProgress > 0.8) {
    const proxyUrgency = (epochProgress - 0.8) / 0.2; // 0 to 1 in last 20%
    urgencyScore += Math.round(proxyUrgency * 20);
  }

  // Factor 4: Volume of active proposals (many = more urgency)
  urgencyScore += Math.min(10, Math.round(activeProposals.length * 1.5));

  // Factor 5: Major treasury proposals (>10M ADA) expiring within 3 epochs
  const MAJOR_THRESHOLD = 10_000_000 * 1_000_000; // 10M ADA in lovelace
  const majorTreasuryExpiring = activeProposals.filter(
    (p) =>
      p.withdrawal_amount != null &&
      Number(p.withdrawal_amount) >= MAJOR_THRESHOLD &&
      p.expiration_epoch != null &&
      p.expiration_epoch <= currentEpoch + 3,
  );
  urgencyScore += Math.min(15, majorTreasuryExpiring.length * 8);

  return Math.min(100, Math.max(0, urgencyScore));
}

function computeTemperature(
  activeCount: number,
  recentCount: number,
  govStats: Record<string, unknown> | null,
): number {
  let tempScore = 0;

  // Factor 1: Active proposal count vs baseline
  // Baseline: ~5-10 active proposals is "normal" for Cardano governance
  const normalizedActivity = Math.min(1, activeCount / 15);
  tempScore += Math.round(normalizedActivity * 30);

  // Factor 2: Recent proposal volume trend (last 3 epochs)
  // ~3 proposals per epoch is baseline; above = hot
  const perEpochAvg = recentCount / 3;
  const volumeHeat = Math.min(1, perEpochAvg / 5);
  tempScore += Math.round(volumeHeat * 30);

  // Factor 3: Participation rate from governance_stats
  if (govStats) {
    const avgParticipation = (govStats.avg_participation as number) ?? 0;
    // Higher participation = hotter governance
    tempScore += Math.round(Math.min(1, avgParticipation / 80) * 20);
  }

  // Factor 4: Base warmth (governance always has some activity)
  tempScore += 10;

  return Math.min(100, Math.max(0, tempScore));
}

async function computeUserState(
  stakeAddress: string,
  _currentEpoch: number,
): Promise<UserGovernanceState> {
  const supabase = createClient();

  try {
    // Check if user is a DRep or has delegation info
    // Look up delegation from user's stake address
    const [drepResult, delegationResult] = await Promise.all([
      // Check if the stake address is a DRep
      supabase.from('dreps').select('id, score').eq('id', stakeAddress).maybeSingle(),
      // Check delegation via Koios (non-blocking)
      fetchDelegation(stakeAddress),
    ]);

    const isDrep = !!drepResult.data;
    const drepId = drepResult.data?.id ?? null;
    const drepScore = drepResult.data?.score ?? null;

    // Pending votes (for DReps only)
    let pendingVotes = 0;
    if (isDrep && drepId) {
      // Count active proposals the DRep hasn't voted on
      const [openResult, votedResult] = await Promise.all([
        supabase
          .from('proposals')
          .select('tx_hash, proposal_index')
          .is('ratified_epoch', null)
          .is('enacted_epoch', null)
          .is('dropped_epoch', null)
          .is('expired_epoch', null),
        supabase
          .from('drep_votes')
          .select('proposal_tx_hash, proposal_index')
          .eq('drep_id', drepId),
      ]);

      const votedKeys = new Set(
        (votedResult.data ?? []).map((v) => `${v.proposal_tx_hash}-${v.proposal_index}`),
      );
      pendingVotes = (openResult.data ?? []).filter(
        (p) => !votedKeys.has(`${p.tx_hash}-${p.proposal_index}`),
      ).length;
    }

    // DRep rank
    let drepRank: number | null = null;
    if (isDrep && drepScore != null) {
      const { count } = await supabase
        .from('dreps')
        .select('*', { count: 'exact', head: true })
        .gt('score', drepScore);
      drepRank = (count ?? 0) + 1;
    }

    return {
      delegatedDrepId: delegationResult,
      pendingVotes,
      hasPendingActions: pendingVotes > 0,
      drepScore,
      drepRank,
    };
  } catch (err) {
    logger.warn('[intelligence/governance-state] User state computation failed', { error: err });
    return {
      delegatedDrepId: null,
      pendingVotes: 0,
      hasPendingActions: false,
      drepScore: null,
      drepRank: null,
    };
  }
}

/**
 * Fetch delegation info for a stake address.
 * Uses Koios API with fallback to null on error.
 */
async function fetchDelegation(stakeAddress: string): Promise<string | null> {
  try {
    const { fetchDelegatedDRep } = await import('@/utils/koios');
    return await fetchDelegatedDRep(stakeAddress);
  } catch {
    return null;
  }
}
