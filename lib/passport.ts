/**
 * Governance Passport — localStorage-backed state for the onboarding journey.
 *
 * The passport tracks a user's progress through the 4-stage get-started flow:
 *   1. Discover (match quiz)
 *   2. Prepare (wallet setup)
 *   3. Connect (wallet connection)
 *   4. Delegate (delegation to matched DRep)
 */

import type { AlignmentScores } from '@/lib/drepIdentity';

export const PASSPORT_STORAGE_KEY = 'governada_passport';

export interface GovernancePassport {
  stage: 1 | 2 | 3 | 4 | 'complete';
  alignment?: AlignmentScores;
  matchedDrepId?: string;
  matchedDrepName?: string;
  matchScore?: number;
  walletReady?: boolean;
  walletPath?: 'wallet' | 'cex' | 'no-ada' | 'exploring';
  connectedAt?: string;
  delegatedAt?: string;
  createdAt: string;
}

/** Load passport from localStorage. Returns null if not found. */
export function loadPassport(): GovernancePassport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PASSPORT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GovernancePassport;
  } catch {
    return null;
  }
}

/** Save passport to localStorage. */
export function savePassport(passport: GovernancePassport): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PASSPORT_STORAGE_KEY, JSON.stringify(passport));
  } catch {
    // localStorage may be unavailable (SSR, private browsing, etc.)
  }
}

/** Create a fresh passport at stage 1. */
export function createPassport(): GovernancePassport {
  return {
    stage: 1,
    createdAt: new Date().toISOString(),
  };
}
