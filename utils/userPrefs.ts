import { DRep, UserPrefKey, UserPrefs } from '@/types/drep';
import { STORAGE_KEYS, readStoredValue, writeStoredValue } from '@/lib/persistence';

export const LS_KEY = STORAGE_KEYS.prefs.current;

export function getUserPrefs(): UserPrefs | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = readStoredValue(STORAGE_KEYS.prefs);
    if (!stored) return null;
    return JSON.parse(stored) as UserPrefs;
  } catch (error) {
    console.error('Failed to parse user prefs:', error);
    return null;
  }
}

export function saveUserPrefs(prefs: UserPrefs): void {
  if (typeof window === 'undefined') return;

  try {
    writeStoredValue(STORAGE_KEYS.prefs, JSON.stringify(prefs));
  } catch (error) {
    console.error('Failed to save user prefs:', error);
  }
}

/**
 * Calculate preference boost score (0-100)
 * Used to adjust sort order based on user values.
 * Returns the base drepScore + boost (capped at 15 pts), max 100.
 */
export function applyPreferenceBoost(
  drep: DRep & { drepScore: number },
  prefs: UserPrefKey[],
): number {
  if (!prefs || prefs.length === 0) return drep.drepScore;

  let boost = 0;

  if (prefs.includes('treasury-conservative')) {
    if (drep.rationaleRate > 50) boost += 4;
  }

  if (prefs.includes('smart-treasury-growth')) {
    if (drep.participationRate > 60) boost += 4;
  }

  if (prefs.includes('strong-decentralization')) {
    // Boost small/medium DReps
    if (drep.sizeTier === 'Small' || drep.sizeTier === 'Medium') boost += 5;
    // Boost consistent DReps
    if (drep.reliabilityScore > 60) boost += 3;
  }

  if (prefs.includes('protocol-security-first')) {
    if (drep.participationRate > 50 && drep.rationaleRate > 40) boost += 4;
  }

  if (prefs.includes('innovation-defi-growth')) {
    if (drep.participationRate > 70) boost += 5;
  }

  if (prefs.includes('responsible-governance')) {
    if (drep.rationaleRate > 60) boost += 5;
  }

  boost = Math.min(boost, 15);

  return Math.min(100, drep.drepScore + boost);
}
