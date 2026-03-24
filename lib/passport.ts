/**
 * Governance Passport — hybrid persistence for onboarding/civic identity state.
 *
 * - Authenticated users (wallet connected): reads/writes from `governance_passport` table via Supabase
 * - Anonymous users: falls back to localStorage
 *
 * The passport tracks a user's civic progression through the governance journey:
 *   - Match results from Globe Convergence
 *   - Governance identity archetype
 *   - Civic level (explorer → citizen → guardian → sentinel)
 *   - Ceremony completion state
 *   - Governance ring scores (participation, deliberation, impact)
 */

export const PASSPORT_STORAGE_KEY = 'governada_passport';

export interface GovernancePassport {
  /** Match results from Globe Convergence */
  matchResults?: Record<string, unknown> | null;
  /** Governance identity archetype */
  matchArchetype?: string | null;
  /** Civic progression level */
  civicLevel: 'explorer' | 'citizen' | 'guardian' | 'sentinel';
  /** Whether the civic ceremony has been completed */
  ceremonyCompleted: boolean;
  /** Participation ring score (0-1) */
  ringParticipation: number;
  /** Deliberation ring score (0-1) */
  ringDeliberation: number;
  /** Impact ring score (0-1) */
  ringImpact: number;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

/** Create a fresh passport with default values. */
export function createPassport(): GovernancePassport {
  const now = new Date().toISOString();
  return {
    civicLevel: 'explorer',
    ceremonyCompleted: false,
    ringParticipation: 0,
    ringDeliberation: 0,
    ringImpact: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// localStorage (anonymous users)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Supabase (authenticated users)
// ---------------------------------------------------------------------------

/** Load passport from Supabase for a given stake address. Server-side only. */
export async function loadPassportFromServer(
  stakeAddress: string,
): Promise<GovernancePassport | null> {
  const { getSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('governance_passport')
    .select('*')
    .eq('stake_address', stakeAddress)
    .single();

  if (error || !data) return null;

  return {
    matchResults: data.match_results as Record<string, unknown> | null,
    matchArchetype: data.match_archetype,
    civicLevel: (data.civic_level as GovernancePassport['civicLevel']) ?? 'explorer',
    ceremonyCompleted: data.ceremony_completed ?? false,
    ringParticipation: data.ring_participation ?? 0,
    ringDeliberation: data.ring_deliberation ?? 0,
    ringImpact: data.ring_impact ?? 0,
    createdAt: data.created_at ?? new Date().toISOString(),
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

/** Save (upsert) passport to Supabase for a given stake address. Server-side only. */
export async function savePassportToServer(
  stakeAddress: string,
  passport: Partial<GovernancePassport>,
): Promise<void> {
  const { getSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getSupabaseAdmin();

  const row = {
    stake_address: stakeAddress,
    match_results: passport.matchResults ?? null,
    match_archetype: passport.matchArchetype ?? null,
    civic_level: passport.civicLevel ?? 'explorer',
    ceremony_completed: passport.ceremonyCompleted ?? false,
    ring_participation: passport.ringParticipation ?? 0,
    ring_deliberation: passport.ringDeliberation ?? 0,
    ring_impact: passport.ringImpact ?? 0,
    updated_at: new Date().toISOString(),
  };

  await supabase.from('governance_passport').upsert(row, { onConflict: 'stake_address' });
}
