/**
 * SPO Governance Identity pillar (15% of SPO Score V3).
 * Two sub-components: Pool Identity Quality (60%) and Delegation Responsiveness (40%).
 *
 * V3 changes from V2:
 * - Governance statement uses keyword quality checklist instead of pure character count
 * - Community Presence replaced by Delegation Responsiveness (delegator retention after votes)
 * - Falls back to delegator count percentile when insufficient retention data
 */

import { isValidatedSocialLink } from '@/utils/display';

const SUB_WEIGHTS = { poolIdentityQuality: 0.6, delegationResponsiveness: 0.4 };

/** Keywords that indicate governance-relevant content in a statement. */
const GOVERNANCE_KEYWORDS = [
  'vote',
  'govern',
  'delegate',
  'cardano',
  'treasury',
  'proposal',
  'constitution',
  'drep',
  'stake',
  'community',
  'accountability',
  'transparency',
  'decentraliz',
];

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

export interface DelegationRetentionData {
  poolId: string;
  delegatorsBefore: number;
  delegatorsAfter: number;
}

/**
 * Compute raw Governance Identity scores (0-100) for all SPOs.
 * Uses delegation responsiveness when available, falls back to delegator count percentile.
 */
export function computeSpoGovernanceIdentity(
  profiles: Map<string, SpoProfileData>,
  allDelegatorCounts: number[],
  retentionData?: Map<string, DelegationRetentionData>,
): Map<string, number> {
  const scores = new Map<string, number>();
  const sortedCounts = [...allDelegatorCounts].sort((a, b) => a - b);

  for (const [poolId, profile] of profiles) {
    const identityScore = computePoolIdentityQuality(profile);
    const responsiveness = retentionData?.get(poolId);

    let communityScore: number;
    if (responsiveness && responsiveness.delegatorsBefore >= 5) {
      // Delegation responsiveness: retention rate after governance activity
      communityScore = computeDelegationResponsiveness(responsiveness);
    } else {
      // Fallback: delegator count percentile
      communityScore = computeCommunityPresencePercentile(profile.delegatorCount, sortedCounts);
    }

    const raw =
      identityScore * SUB_WEIGHTS.poolIdentityQuality +
      communityScore * SUB_WEIGHTS.delegationResponsiveness;

    scores.set(poolId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Pool Identity Quality (60% of pillar).
 * V3: governance statement uses keyword quality checklist:
 * - Present (5pts) + >100 chars (5pts) + governance keywords (5pts) + unique from description (5pts)
 * Other fields unchanged from V2.
 *
 * Max raw: ticker(10) + poolName(10) + govStatement(20) + description(15) + homepage(10) + social(30) + hash(5) = 100
 */
function computePoolIdentityQuality(profile: SpoProfileData): number {
  let score = 0;

  if (profile.ticker && profile.ticker.length > 0) score += 10;
  if (profile.poolName && profile.poolName.length > 2) score += 10;

  // Governance statement: keyword quality checklist (max 20)
  score += scoreGovernanceStatement(profile.governanceStatement, profile.poolDescription);

  // Pool description: tiered by length (max 15)
  score += tierScore(profile.poolDescription, [
    { minLen: 200, pts: 15 },
    { minLen: 50, pts: 10 },
    { minLen: 1, pts: 3 },
  ]);

  // Homepage URL (10 pts)
  if (profile.homepageUrl) {
    try {
      const url = new URL(profile.homepageUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        if (!profile.brokenUris?.has(profile.homepageUrl)) {
          score += 10;
        }
      }
    } catch {
      // invalid URL
    }
  }

  // Social links (max 30)
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
 * Governance statement quality checklist (max 20 points):
 * - Present and non-empty: 5 pts
 * - >100 characters: 5 pts
 * - Contains >= 3 governance keywords: 5 pts
 * - Content distinct from pool description (Jaccard > 0.5): 5 pts
 */
function scoreGovernanceStatement(
  statement: string | null | undefined,
  description: string | null | undefined,
): number {
  if (!statement?.trim()) return 0;
  const trimmed = statement.trim();
  let pts = 5; // present

  if (trimmed.length > 100) pts += 5;

  // Keyword check
  const lower = trimmed.toLowerCase();
  const matchedKeywords = GOVERNANCE_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matchedKeywords.length >= 3) pts += 5;

  // Uniqueness check: Jaccard distance from description
  if (description?.trim()) {
    const stmtWords = new Set(lower.split(/\s+/).filter((w) => w.length > 3));
    const descWords = new Set(
      description
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
    const intersection = [...stmtWords].filter((w) => descWords.has(w)).length;
    const union = new Set([...stmtWords, ...descWords]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    if (jaccard < 0.5) pts += 5; // sufficiently unique
  } else {
    pts += 5; // no description to compare against, give full credit
  }

  return pts;
}

/**
 * Delegation Responsiveness (40% of pillar).
 * Measures delegator retention in epochs following governance votes.
 * retentionRate = delegatorsAfter / delegatorsBefore, clamped to 0-100.
 */
function computeDelegationResponsiveness(data: DelegationRetentionData): number {
  if (data.delegatorsBefore === 0) return 50;
  const rate = data.delegatorsAfter / data.delegatorsBefore;
  // Score: 100% retention = 100, 90% = 90, etc.
  // Allow growth beyond 100% (capped at 100 score)
  return clamp(Math.round(rate * 100));
}

/**
 * Fallback: delegator count percentile (same as V2).
 */
function computeCommunityPresencePercentile(
  delegatorCount: number,
  sortedCounts: number[],
): number {
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
