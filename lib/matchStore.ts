/**
 * Match Store — persists Quick Match results in localStorage so users can
 * revisit their match results and sort Discover by match compatibility.
 */

import type { AlignmentScores } from '@/lib/drepIdentity';

const STORAGE_KEY = 'governada_match_profile';

export interface StoredMatchProfile {
  userAlignments: AlignmentScores;
  personalityLabel: string;
  identityColor: string;
  matchType: 'drep' | 'spo';
  answers: Record<string, string>;
  timestamp: number;
}

/** Save match profile to localStorage. */
export function saveMatchProfile(profile: StoredMatchProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage may be unavailable (SSR, private browsing, etc.)
  }
}

/** Load match profile from localStorage. Returns null if not found or expired (>30 days). */
export function loadMatchProfile(): StoredMatchProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const profile: StoredMatchProfile = JSON.parse(raw);
    // Expire after 30 days
    if (Date.now() - profile.timestamp > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

/** Clear stored match profile. */
export function clearMatchProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** Check if a stored match profile exists (without loading full data). */
export function hasMatchProfile(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Compute Euclidean distance between user alignment and a DRep/SPO alignment.
 * Used by Discover page to sort by match compatibility.
 */
export function alignmentDistance(user: AlignmentScores, entity: AlignmentScores): number {
  const dims: (keyof AlignmentScores)[] = [
    'treasuryConservative',
    'treasuryGrowth',
    'decentralization',
    'security',
    'innovation',
    'transparency',
  ];
  let sum = 0;
  for (const dim of dims) {
    const diff = ((user[dim] as number) ?? 50) - ((entity[dim] as number) ?? 50);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Convert distance to match score (0-100). Same formula as the API.
 */
export function distanceToMatchScore(distance: number): number {
  const maxDist = 245;
  return Math.max(0, Math.round((1 - distance / maxDist) * 100));
}
