/**
 * Citizen Credibility Scoring
 *
 * Computes a credibility weight (0.1 to 1.0) per user based on their
 * governance participation history. Used to weight engagement signals
 * so long-term active citizens have more influence than anonymous accounts.
 *
 * The weighting is invisible to users except for a tier display
 * (standard / enhanced / full). Not punitive to new users — everyone
 * starts with a voice, credibility grows with participation.
 */

import { getSupabaseAdmin } from './supabase';

export type CredibilityTier = 'standard' | 'enhanced' | 'full';

export interface CredibilityResult {
  weight: number;
  tier: CredibilityTier;
  factors: {
    walletConnected: boolean;
    delegationActive: boolean;
    delegationEpochs: number;
    priorEngagementCount: number;
    hasBalance: boolean;
  };
}

export interface CredibilityTierInfo {
  tier: CredibilityTier;
  label: string;
  tip: string;
}

/**
 * Map a numeric weight to a user-friendly tier with actionable tip.
 * Thresholds are generous: standard < 0.5, enhanced < 0.8, full >= 0.8.
 */
export function getCredibilityTierInfo(weight: number): CredibilityTierInfo {
  if (weight >= 0.8) {
    return {
      tier: 'full',
      label: 'Full weight',
      tip: 'Your signals carry full weight. Thank you for your sustained participation.',
    };
  }
  if (weight >= 0.5) {
    return {
      tier: 'enhanced',
      label: 'Enhanced weight',
      tip: 'Maintain your delegation and keep participating to reach full weight.',
    };
  }
  return {
    tier: 'standard',
    label: 'Standard weight',
    tip: 'Connect your wallet, delegate to a DRep, and participate regularly to increase your signal weight.',
  };
}

/**
 * Lightweight credibility computation from pre-fetched data.
 * Use this in pipelines/batch contexts to avoid DB queries.
 */
export function computeCredibilityWeightFromData(params: {
  isAuthenticated: boolean;
  hasDelegation: boolean;
  delegationStreakEpochs: number;
  totalEngagementActions: number;
  hasSignificantBalance: boolean;
}): number {
  if (!params.isAuthenticated) return 0.1;
  let weight = 0.3;
  if (params.hasDelegation) {
    weight += 0.2;
    weight += Math.min(0.2, params.delegationStreakEpochs * 0.01);
  }
  if (params.totalEngagementActions >= 20) weight += 0.2;
  else if (params.totalEngagementActions >= 5) weight += 0.1;
  if (params.hasSignificantBalance) weight += 0.1;
  return Math.min(1.0, Math.round(weight * 100) / 100);
}

/**
 * Compute citizen credibility weight for a user.
 *
 * Breakdown:
 *   - Anonymous (no wallet): 0.1 base
 *   - Wallet connected: 0.3 base
 *   - Active delegation: +0.2
 *   - Delegation duration: +0.01 per epoch, max +0.2
 *   - Prior engagement (5+): +0.1, (20+): +0.2
 *   - Wallet balance >1K ADA: +0.1 (light, avoids plutocracy)
 *
 * Cap: 1.0. Minimum: 0.1.
 *
 * Tiers (generous to new users):
 *   - standard: 0.1–0.49
 *   - enhanced: 0.5–0.79
 *   - full: 0.8–1.0
 */
export async function computeCredibility(
  userId: string | null,
  walletAddress: string | null,
): Promise<CredibilityResult> {
  const defaultResult: CredibilityResult = {
    weight: 0.1,
    tier: 'standard',
    factors: {
      walletConnected: false,
      delegationActive: false,
      delegationEpochs: 0,
      priorEngagementCount: 0,
      hasBalance: false,
    },
  };

  if (!userId || !walletAddress) return defaultResult;

  const supabase = getSupabaseAdmin();
  let weight = 0.3; // wallet connected base

  // Fetch wallet data
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('drep_id, delegation_streak_epochs')
    .eq('user_id', userId)
    .order('last_used', { ascending: false })
    .limit(1)
    .maybeSingle();

  const delegationActive = !!wallet?.drep_id;
  const delegationEpochs =
    (wallet as { delegation_streak_epochs?: number } | null)?.delegation_streak_epochs ?? 0;

  if (delegationActive) weight += 0.2;
  weight += Math.min(delegationEpochs * 0.01, 0.2);

  // Prior engagement count (sentiment + concerns + priorities)
  const [sentimentResult, concernResult, priorityResult] = await Promise.all([
    supabase
      .from('citizen_sentiment')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('citizen_concern_flags')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('citizen_priority_signals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  const engagementCount =
    (sentimentResult.count ?? 0) + (concernResult.count ?? 0) + (priorityResult.count ?? 0);

  if (engagementCount >= 20) weight += 0.2;
  else if (engagementCount >= 5) weight += 0.1;

  // Balance check — only if stake address available
  // Use DRep power snapshot as proxy (delegated ADA)
  let hasBalance = false;
  if (wallet?.drep_id) {
    const { data: snapshot } = await supabase
      .from('drep_power_snapshots')
      .select('live_stake_lovelace')
      .eq('drep_id', wallet.drep_id)
      .order('epoch_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    const ada = (snapshot?.live_stake_lovelace ?? 0) / 1_000_000;
    if (ada > 1_000) {
      hasBalance = true;
      weight += 0.1;
    }
  }

  weight = Math.min(weight, 1.0);

  const tier: CredibilityTier = weight >= 0.8 ? 'full' : weight >= 0.5 ? 'enhanced' : 'standard';

  return {
    weight,
    tier,
    factors: {
      walletConnected: true,
      delegationActive,
      delegationEpochs,
      priorEngagementCount: engagementCount,
      hasBalance,
    },
  };
}

/**
 * Lightweight credibility lookup — computes on the fly.
 * For batch operations in precompute, use computeCredibilityBatch instead.
 */
export async function getCredibilityWeight(
  userId: string | null,
  walletAddress: string | null,
): Promise<number> {
  const result = await computeCredibility(userId, walletAddress);
  return result.weight;
}

/**
 * Batch credibility computation for the precompute function.
 * Fetches all user data in bulk, then computes weights in memory.
 */
export async function computeCredibilityBatch(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const supabase = getSupabaseAdmin();
  const weights = new Map<string, number>();

  // Batch fetch wallet data
  const { data: wallets } = await supabase
    .from('user_wallets')
    .select('user_id, drep_id, delegation_streak_epochs')
    .in('user_id', userIds);

  const walletMap = new Map<string, { drep_id: string | null; delegation_streak_epochs: number }>();
  for (const w of wallets || []) {
    walletMap.set(w.user_id, {
      drep_id: w.drep_id,
      delegation_streak_epochs:
        (w as { delegation_streak_epochs?: number }).delegation_streak_epochs ?? 0,
    });
  }

  // Batch fetch engagement counts per user
  const [sentiments, concerns, priorities] = await Promise.all([
    supabase.from('citizen_sentiment').select('user_id').in('user_id', userIds),
    supabase.from('citizen_concern_flags').select('user_id').in('user_id', userIds),
    supabase.from('citizen_priority_signals').select('user_id').in('user_id', userIds),
  ]);

  const engagementCounts = new Map<string, number>();
  for (const s of sentiments.data || []) {
    engagementCounts.set(s.user_id, (engagementCounts.get(s.user_id) ?? 0) + 1);
  }
  for (const c of concerns.data || []) {
    engagementCounts.set(c.user_id, (engagementCounts.get(c.user_id) ?? 0) + 1);
  }
  for (const p of priorities.data || []) {
    engagementCounts.set(p.user_id, (engagementCounts.get(p.user_id) ?? 0) + 1);
  }

  // Compute weight per user
  for (const uid of userIds) {
    let weight = 0.3; // wallet connected base (they have a userId so wallet is connected)
    const wallet = walletMap.get(uid);

    if (wallet?.drep_id) weight += 0.2;
    const streak = wallet?.delegation_streak_epochs ?? 0;
    weight += Math.min(streak * 0.01, 0.2);

    const engagement = engagementCounts.get(uid) ?? 0;
    if (engagement >= 20) weight += 0.2;
    else if (engagement >= 5) weight += 0.1;

    // Skip balance check in batch mode — too many queries.
    // The 0.1 balance bonus is omitted in batch for performance.

    weights.set(uid, Math.min(weight, 1.0));
  }

  return weights;
}
