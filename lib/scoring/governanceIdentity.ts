/**
 * Governance Identity pillar (15% of DRep Score).
 * Two sub-components: Profile Quality (60%) and Community Presence (40%).
 * Replaces the old binary profile completeness check.
 */

import { isValidatedSocialLink } from '@/utils/display';
import type { DRepProfileData } from './types';
import { IDENTITY_WEIGHTS, PROFILE_FIELD_SCORES, DELEGATOR_TIERS } from './calibration';

const SUB_WEIGHTS = IDENTITY_WEIGHTS;

/**
 * Compute raw Governance Identity scores (0-100) for all DReps.
 *
 * @param profiles Per-DRep profile data (metadata, delegator count, hash verified)
 */
export function computeGovernanceIdentity(
  profiles: Map<string, DRepProfileData>,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [drepId, profile] of profiles) {
    const profileScore = computeProfileQuality(profile);
    const communityScore = computeCommunityPresence(profile.delegatorCount);

    const raw =
      profileScore * SUB_WEIGHTS.profileQuality + communityScore * SUB_WEIGHTS.communityPresence;

    scores.set(drepId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Profile Quality (60% of pillar).
 * Quality-tiered field scoring instead of binary has/hasn't.
 * Max raw: name(15) + objectives(20) + motivations(15) + qualifications(10)
 *        + bio(10) + social(30) + hashVerified(5) = 105, clamped to 100.
 */
function computeProfileQuality(profile: DRepProfileData): number {
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

  return Math.min(100, score);
}

/**
 * Community Presence (40% of pillar).
 * Absolute delegator count tiers: every DRep can reach 100 by growing
 * their community. Not zero-sum — independent of other DReps' counts.
 */
function computeCommunityPresence(delegatorCount: number): number {
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
