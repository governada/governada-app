/**
 * SPO Governance Identity pillar (15% of SPO Score V2).
 * Two sub-components: Pool Identity Quality (60%) and Community Presence (40%).
 * Structural parity with DRep Governance Identity (ADR-006).
 *
 * Works for unclaimed pools (baseline from on-chain metadata) and rewards
 * claimed profiles with governance statement, social links, and homepage.
 */

import { isValidatedSocialLink } from '@/utils/display';

const SUB_WEIGHTS = { poolIdentityQuality: 0.6, communityPresence: 0.4 };

export interface SpoProfileData {
  poolId: string;
  ticker: string | null;
  poolName: string | null;
  governanceStatement: string | null;
  poolDescription: string | null;
  homepageUrl: string | null;
  socialLinks: Array<{ uri: string; label?: string }>;
  metadataHashVerified: boolean;
  delegatorCount: number;
  brokenUris?: Set<string>;
}

/**
 * Compute raw Governance Identity scores (0-100) for all SPOs.
 */
export function computeSpoGovernanceIdentity(
  profiles: Map<string, SpoProfileData>,
  allDelegatorCounts: number[],
): Map<string, number> {
  const scores = new Map<string, number>();
  const sortedCounts = [...allDelegatorCounts].sort((a, b) => a - b);

  for (const [poolId, profile] of profiles) {
    const identityScore = computePoolIdentityQuality(profile);
    const communityScore = computeCommunityPresence(profile.delegatorCount, sortedCounts);

    const raw =
      identityScore * SUB_WEIGHTS.poolIdentityQuality +
      communityScore * SUB_WEIGHTS.communityPresence;

    scores.set(poolId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Pool Identity Quality (60% of pillar).
 * Quality-tiered scoring — max raw: ticker(10) + poolName(10) + govStatement(20)
 * + description(15) + homepage(10) + social(30) + hashVerified(5) = 100, clamped.
 *
 * Unclaimed pools score from on-chain data: ticker + poolName + hash = 25 baseline.
 * Claiming unlocks governance statement, description, social links, homepage = +75.
 */
function computePoolIdentityQuality(profile: SpoProfileData): number {
  let score = 0;

  if (profile.ticker && profile.ticker.length > 0) score += 10;

  if (profile.poolName && profile.poolName.length > 2) score += 10;

  score += tierScore(profile.governanceStatement, [
    { minLen: 200, pts: 20 },
    { minLen: 50, pts: 15 },
    { minLen: 1, pts: 5 },
  ]);

  score += tierScore(profile.poolDescription, [
    { minLen: 200, pts: 15 },
    { minLen: 50, pts: 10 },
    { minLen: 1, pts: 3 },
  ]);

  if (profile.homepageUrl) {
    try {
      const url = new URL(profile.homepageUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        if (!profile.brokenUris?.has(profile.homepageUrl)) {
          score += 10;
        }
      }
    } catch {
      // invalid URL — no points
    }
  }

  if (Array.isArray(profile.socialLinks)) {
    let validCount = 0;
    const seenUris = new Set<string>();
    for (const link of profile.socialLinks) {
      if (!link?.uri || seenUris.has(link.uri)) continue;
      seenUris.add(link.uri);
      if (isValidatedSocialLink(link.uri, link.label)) {
        if (profile.brokenUris?.has(link.uri)) continue;
        validCount++;
      }
    }
    if (validCount >= 2) score += 30;
    else if (validCount >= 1) score += 25;
  }

  if (profile.metadataHashVerified) score += 5;

  return Math.min(100, score);
}

/**
 * Community Presence (40% of pillar).
 * Delegator count percentile — count-based to measure trust breadth.
 * Same algorithm as DRep Governance Identity.
 */
function computeCommunityPresence(delegatorCount: number, sortedCounts: number[]): number {
  if (sortedCounts.length === 0) return 0;
  if (sortedCounts.length === 1) return 50;

  let lo = 0;
  let hi = sortedCounts.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedCounts[mid] < delegatorCount) lo = mid + 1;
    else hi = mid;
  }

  let first = lo;
  let last = lo;
  while (first > 0 && sortedCounts[first - 1] === delegatorCount) first--;
  while (last < sortedCounts.length - 1 && sortedCounts[last + 1] === delegatorCount) last++;

  const avgRank = (first + last) / 2;
  return Math.round((avgRank / (sortedCounts.length - 1)) * 100);
}

interface Tier {
  minLen: number;
  pts: number;
}

function tierScore(text: string | null | undefined, tiers: Tier[]): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  for (const tier of tiers) {
    if (trimmed.length >= tier.minLen) return tier.pts;
  }
  return 0;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
