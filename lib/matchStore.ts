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

/* ─── Conversational Match Profile ─────────────────────── */

const CONV_STORAGE_KEY = 'governada_conv_match_profile';

export interface StoredConversationalProfile {
  personalityLabel: string;
  identityColor: string;
  alignments: AlignmentScores;
  matchResults: Array<{
    drepId: string;
    drepName: string | null;
    score: number;
    agreeDimensions: string[];
    differDimensions: string[];
    identityColor: string;
  }>;
  timestamp: number;
}

/** Save conversational match profile to localStorage. */
export function saveConversationalProfile(profile: StoredConversationalProfile): void {
  try {
    localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage may be unavailable
  }
}

/** Load conversational match profile. Returns null if not found or expired (>30 days). */
export function loadConversationalProfile(): StoredConversationalProfile | null {
  try {
    const raw = localStorage.getItem(CONV_STORAGE_KEY);
    if (!raw) return null;
    const profile: StoredConversationalProfile = JSON.parse(raw);
    if (Date.now() - profile.timestamp > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CONV_STORAGE_KEY);
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

/** Clear stored conversational match profile. */
export function clearConversationalProfile(): void {
  try {
    localStorage.removeItem(CONV_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/* ─── Alignment History (evolution tracking) ──────────── */

const ALIGNMENT_HISTORY_KEY = 'governada_alignment_history';
const MAX_HISTORY_ENTRIES = 10;

export interface AlignmentHistoryEntry {
  alignments: AlignmentScores;
  archetype: string;
  epoch: number;
  timestamp: number;
}

/**
 * Append an alignment snapshot to localStorage history.
 * Keeps the last MAX_HISTORY_ENTRIES entries. Deduplicates by epoch — if an
 * entry for the same epoch already exists, it is updated in place.
 */
export function saveAlignmentHistory(
  alignments: AlignmentScores,
  archetype: string,
  epoch: number,
): void {
  try {
    const existing = loadAlignmentHistory();
    const now = Date.now();

    // Check if we already have an entry for this epoch — update it
    const epochIndex = existing.findIndex((e) => e.epoch === epoch);
    if (epochIndex >= 0) {
      existing[epochIndex] = { alignments, archetype, epoch, timestamp: now };
    } else {
      existing.push({ alignments, archetype, epoch, timestamp: now });
    }

    // Keep only latest entries
    const trimmed = existing.slice(-MAX_HISTORY_ENTRIES);
    localStorage.setItem(ALIGNMENT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable
  }
}

/** Load alignment history from localStorage. */
export function loadAlignmentHistory(): AlignmentHistoryEntry[] {
  try {
    const raw = localStorage.getItem(ALIGNMENT_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AlignmentHistoryEntry[];
  } catch {
    return [];
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
