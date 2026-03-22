/**
 * Governance Identity pillar (10% of DRep Score).
 * Two sub-components: Profile Quality (60%) and Community Presence (40%).
 *
 * V3.2 changes:
 * - Community Presence: delegation health signals (retention, diversity, growth)
 *   with graceful fallback to delegator count tiers when no snapshot history.
 * - Profile Quality: staleness decay based on profile update timestamp.
 */

import { isValidatedSocialLink } from '@/utils/display';
import type { DRepProfileData, DelegationSnapshotData } from './types';
import {
  IDENTITY_WEIGHTS,
  PROFILE_FIELD_SCORES,
  DELEGATOR_TIERS,
  DELEGATION_HEALTH,
  PROFILE_STALENESS,
} from './calibration';

const SUB_WEIGHTS = IDENTITY_WEIGHTS;

/**
 * Compute raw Governance Identity scores (0-100) for all DReps.
 *
 * @param profiles Per-DRep profile data (metadata, delegator count, hash verified, updatedAt)
 * @param delegationSnapshots Per-DRep delegation snapshot history (may be empty)
 * @param nowSeconds Current time in unix seconds (for staleness calculation)
 */
export function computeGovernanceIdentity(
  profiles: Map<string, DRepProfileData>,
  delegationSnapshots?: Map<string, DelegationSnapshotData>,
  nowSeconds?: number,
): Map<string, number> {
  const scores = new Map<string, number>();
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);

  for (const [drepId, profile] of profiles) {
    const profileScore = computeProfileQuality(profile, now);
    const snapshot = delegationSnapshots?.get(drepId);
    const communityScore = computeCommunityPresence(profile.delegatorCount, snapshot);

    const raw =
      profileScore * SUB_WEIGHTS.profileQuality + communityScore * SUB_WEIGHTS.communityPresence;

    scores.set(drepId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Profile Quality (60% of pillar).
 * Quality-tiered field scoring with V3.2 staleness decay.
 */
function computeProfileQuality(profile: DRepProfileData, nowSeconds: number): number {
  const meta = profile.metadata;
  if (!meta) return 0;

  let score = 0;

  // Name: binary (it's a name, quality tiers don't apply)
  if (extractString(meta.givenName) || extractString(meta.name)) score += PROFILE_FIELD_SCORES.name;

  // Objectives: quality-tiered by length
  score += tierScore(extractString(meta.objectives), PROFILE_FIELD_SCORES.objectives);

  // Motivations
  score += tierScore(extractString(meta.motivations), PROFILE_FIELD_SCORES.motivations);

  // Qualifications
  score += tierScore(extractString(meta.qualifications), PROFILE_FIELD_SCORES.qualifications);

  // Bio
  score += tierScore(extractString(meta.bio), PROFILE_FIELD_SCORES.bio);

  // Social links: keep existing validation logic
  const references = meta.references;
  if (Array.isArray(references)) {
    let validCount = 0;
    const seenUris = new Set<string>();
    for (const ref of references) {
      if (ref && typeof ref === 'object' && 'uri' in ref) {
        const { uri, label } = ref as { uri: string; label?: string };
        if (!uri || seenUris.has(uri)) continue;
        seenUris.add(uri);
        if (isValidatedSocialLink(uri, label)) {
          if (profile.brokenUris?.has(uri)) continue;
          validCount++;
        }
      }
    }
    if (validCount >= 2) score += PROFILE_FIELD_SCORES.socialLinks.twoOrMore;
    else if (validCount >= 1) score += PROFILE_FIELD_SCORES.socialLinks.one;
  }

  // Hash verification bonus
  if (profile.metadataHashVerified) score += PROFILE_FIELD_SCORES.hashVerified;

  const rawProfile = Math.min(100, score);

  // V3.2: Apply staleness decay (prefer profileLastChangedAt over updatedAt)
  const stalenessTimestamp = profile.profileLastChangedAt ?? profile.updatedAt;
  const stalenessFactor = computeStalenessFactor(stalenessTimestamp, nowSeconds);
  return rawProfile * stalenessFactor;
}

/**
 * V3.2 Staleness factor for profile quality.
 * - 0-180 days since update: full credit (1.0x)
 * - 180-360 days: linear decay to floor (0.5x)
 * - 360+ days: floor (0.5x)
 * - null updatedAt: assume fresh (1.0x)
 */
export function computeStalenessFactor(
  updatedAtSeconds: number | null,
  nowSeconds: number,
): number {
  if (updatedAtSeconds == null) return 1.0;

  const daysSinceUpdate = (nowSeconds - updatedAtSeconds) / 86400;
  if (daysSinceUpdate <= PROFILE_STALENESS.freshDays) return 1.0;
  if (daysSinceUpdate <= PROFILE_STALENESS.staleDays) {
    return (
      1.0 -
      (1.0 - PROFILE_STALENESS.floor) *
        ((daysSinceUpdate - PROFILE_STALENESS.freshDays) /
          (PROFILE_STALENESS.staleDays - PROFILE_STALENESS.freshDays))
    );
  }
  return PROFILE_STALENESS.floor;
}

/**
 * Community Presence (40% of pillar).
 * V3.2: Uses delegation health signals when snapshot history is available,
 * falls back to delegator count tiers otherwise.
 */
function computeCommunityPresence(
  delegatorCount: number,
  snapshot?: DelegationSnapshotData,
): number {
  // If we have enough snapshot history, use delegation health
  if (snapshot && snapshot.epochs.length >= DELEGATION_HEALTH.minSnapshotsForHealth) {
    return computeDelegationHealth(snapshot, delegatorCount);
  }

  // Fallback: original delegator count tiers
  return computeDelegatorCountFallback(delegatorCount);
}

/**
 * V3.2 Delegation Health scoring with three sub-signals.
 * Only called when sufficient snapshot history exists.
 */
export function computeDelegationHealth(
  snapshot: DelegationSnapshotData,
  delegatorCount: number,
): number {
  const w = DELEGATION_HEALTH.weights;

  const retention = computeRetentionRate(snapshot);
  const diversity = computeDelegationDiversity(snapshot, delegatorCount);
  const growth = computeOrganicGrowthRate(snapshot);

  return clamp(
    Math.round(retention * w.retention + diversity * w.diversity + growth * w.organicGrowth),
  );
}

/**
 * Delegator retention rate: what fraction of delegators from the previous
 * epoch are still delegating in the current epoch?
 *
 * Uses new_delegators and lost_delegators fields when available.
 * Formula: retained = previous - lost; rate = retained / previous * 100
 */
function computeRetentionRate(snapshot: DelegationSnapshotData): number {
  const epochs = snapshot.epochs;
  if (epochs.length < 2) return 50; // neutral

  // Use the last two epochs for retention
  const current = epochs[epochs.length - 1];
  const previous = epochs[epochs.length - 2];

  if (previous.delegatorCount === 0) return current.delegatorCount > 0 ? 100 : 50;

  // If lost_delegators is available, use it directly
  if (current.lostDelegators != null) {
    const retained = previous.delegatorCount - current.lostDelegators;
    return clamp(Math.round((Math.max(0, retained) / previous.delegatorCount) * 100));
  }

  // Fallback: estimate from count changes. If current >= previous, assume full retention.
  // If current < previous, assume difference = lost.
  if (current.delegatorCount >= previous.delegatorCount) return 100;
  return clamp(Math.round((current.delegatorCount / previous.delegatorCount) * 100));
}

/**
 * Delegation diversity via Herfindahl-Hirschman Index (HHI).
 * Lower concentration = higher score.
 * Falls back to delegator count heuristic when ADA amounts unavailable.
 */
function computeDelegationDiversity(
  snapshot: DelegationSnapshotData,
  delegatorCount: number,
): number {
  // Use the latest epoch's data
  const latest = snapshot.epochs[snapshot.epochs.length - 1];

  // If we have total power and delegator count, use a simplified HHI estimate.
  // With uniform distribution: HHI = 1/n. Score = (1 - HHI) * 100.
  // Without per-delegator breakdown, we approximate:
  // - If delegatorCount > 0 and totalPower > 0, assume roughly even split
  //   (biased toward higher diversity, which is conservative/fair).
  // - The actual HHI would require per-delegator ADA amounts which we don't have yet.
  if (latest.totalPowerLovelace > 0 && delegatorCount > 0) {
    // Simplified: assume uniform → HHI = 1/n
    const hhi = 1 / delegatorCount;
    return clamp(Math.round((1 - hhi) * 100));
  }

  // Fallback: more delegators ≈ more diverse
  return Math.min(100, delegatorCount * DELEGATION_HEALTH.diversityFallbackMultiplier);
}

/**
 * Organic growth rate: average new delegators per epoch over a window,
 * scored on a curve.
 */
function computeOrganicGrowthRate(snapshot: DelegationSnapshotData): number {
  const epochs = snapshot.epochs;
  if (epochs.length < 2) return DELEGATION_HEALTH.neutralGrowthScore;

  // Calculate average new delegators over the last N epochs
  const window = Math.min(DELEGATION_HEALTH.growthWindowEpochs, epochs.length);
  const recentEpochs = epochs.slice(-window);

  let totalNew = 0;
  let countWithData = 0;

  for (const ep of recentEpochs) {
    if (ep.newDelegators != null) {
      totalNew += ep.newDelegators;
      countWithData++;
    }
  }

  // If no new_delegators data, estimate from count changes
  if (countWithData === 0) {
    for (let i = 1; i < recentEpochs.length; i++) {
      const diff = recentEpochs[i].delegatorCount - recentEpochs[i - 1].delegatorCount;
      if (diff > 0) totalNew += diff;
      countWithData++;
    }
  }

  if (countWithData === 0) return DELEGATION_HEALTH.neutralGrowthScore;

  const avgNewPerEpoch = totalNew / countWithData;

  // Score using the growth curve
  for (const tier of DELEGATION_HEALTH.growthCurve) {
    if (avgNewPerEpoch >= tier.minGrowth) return tier.score;
  }
  return 0;
}

/**
 * Original delegator count tiers fallback.
 * Used when delegation snapshot history is unavailable.
 */
function computeDelegatorCountFallback(delegatorCount: number): number {
  for (const tier of DELEGATOR_TIERS) {
    if (delegatorCount >= tier.min) return tier.score;
  }
  return 0;
}

// --- Helpers ---

interface Tier {
  minLen: number;
  pts: number;
}

function tierScore(text: string | null, tiers: readonly Tier[]): number {
  if (!text) return 0;
  // Tiers are sorted highest-first
  for (const tier of tiers) {
    if (text.length >= tier.minLen) return tier.pts;
  }
  return 0;
}

function extractString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && '@value' in (value as object)) {
    const inner = (value as Record<string, unknown>)['@value'];
    if (typeof inner === 'string') return inner.trim() || null;
  }
  return null;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
