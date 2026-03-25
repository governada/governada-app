'use client';

/**
 * useSenecaWarmth — Manages Seneca's warm, context-aware opening state.
 *
 * Detects:
 * - First visit vs returning visitor (localStorage)
 * - Post-match state (match results in localStorage)
 * - Wallet extension presence (Eternl, Nami, Vespr, Lace, Flint, Typhon)
 * - Time of day for greeting warmth
 *
 * Returns the appropriate Dock content state so the SenecaDock can
 * render warm, context-aware copy instead of generic ghost prompts.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DockState = 'first-visit' | 'returning' | 'post-match';

export interface MatchMemory {
  topMatches: Array<{ name: string; score: number }>;
  timestamp: number;
  archetype?: string;
}

export interface SenecaWarmthResult {
  /** Which dock variant to render */
  dockState: DockState;
  /** Whether a Cardano wallet extension was detected */
  walletDetected: boolean;
  /** Previous match results, if any */
  matchMemory: MatchMemory | null;
  /** Time-aware greeting prefix */
  greeting: string;
  /** Mark the user as having visited (call after first render) */
  markVisited: () => void;
  /** Save match results for cross-session memory */
  saveMatchMemory: (matches: MatchMemory) => void;
  /** Clear match memory */
  clearMatchMemory: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISITED_KEY = 'governada_seneca_visited';
const MATCH_MEMORY_KEY = 'governada_seneca_matches';
/** Match memory expires after 30 days */
const MATCH_MEMORY_TTL = 30 * 24 * 60 * 60 * 1000;

/** Known Cardano wallet extension window properties */
const WALLET_EXTENSIONS = [
  'eternl',
  'nami',
  'vespr',
  'lace',
  'flint',
  'typhon',
  'yoroi',
  'nufi',
  'gerowallet',
  'begin',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function detectWallet(): boolean {
  if (typeof window === 'undefined') return false;
  const cardano = (window as unknown as Record<string, unknown>).cardano;
  if (!cardano || typeof cardano !== 'object') return false;
  return WALLET_EXTENSIONS.some((ext) => ext in (cardano as Record<string, unknown>));
}

function loadMatchMemory(): MatchMemory | null {
  try {
    const raw = localStorage.getItem(MATCH_MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MatchMemory;
    // Check TTL
    if (Date.now() - parsed.timestamp > MATCH_MEMORY_TTL) {
      localStorage.removeItem(MATCH_MEMORY_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hasVisited(): boolean {
  try {
    return localStorage.getItem(VISITED_KEY) === 'true';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSenecaWarmth(): SenecaWarmthResult {
  const [visited, setVisited] = useState(false);
  const [matchMemory, setMatchMemory] = useState<MatchMemory | null>(null);
  const [walletDetected, setWalletDetected] = useState(false);
  const searchParams = useSearchParams();

  // Admin QA: ?seneca_state=first_visit|returning|post_match overrides dock state
  const adminOverride = searchParams.get('seneca_state') as
    | 'first_visit'
    | 'returning'
    | 'post_match'
    | null;

  // Initialize on mount
  useEffect(() => {
    setVisited(hasVisited());
    setMatchMemory(loadMatchMemory());
    // Slight delay for wallet detection — extensions inject after DOMContentLoaded
    const timer = setTimeout(() => {
      setWalletDetected(detectWallet());
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const dockState = useMemo<DockState>(() => {
    // Admin QA override
    if (adminOverride === 'first_visit') return 'first-visit';
    if (adminOverride === 'returning') return 'returning';
    if (adminOverride === 'post_match') return 'post-match';
    if (matchMemory) return 'post-match';
    if (visited) return 'returning';
    return 'first-visit';
  }, [visited, matchMemory, adminOverride]);

  // For admin QA: provide synthetic match memory when forcing post_match state
  const effectiveMatchMemory = useMemo<MatchMemory | null>(() => {
    if (adminOverride === 'post_match' && !matchMemory) {
      return {
        topMatches: [
          { name: 'ShelleyGov', score: 87 },
          { name: 'CardanoGuardian', score: 82 },
          { name: 'TreasuryWatch', score: 79 },
        ],
        timestamp: Date.now(),
        archetype: 'Treasury Guardian',
      };
    }
    return matchMemory;
  }, [adminOverride, matchMemory]);

  const greeting = useMemo(() => getTimeGreeting(), []);

  const markVisited = () => {
    try {
      localStorage.setItem(VISITED_KEY, 'true');
      setVisited(true);
    } catch {
      // localStorage unavailable
    }
  };

  const saveMatchMemory = (matches: MatchMemory) => {
    try {
      const data = { ...matches, timestamp: Date.now() };
      localStorage.setItem(MATCH_MEMORY_KEY, JSON.stringify(data));
      setMatchMemory(data);
    } catch {
      // localStorage unavailable
    }
  };

  const clearMatchMemory = () => {
    try {
      localStorage.removeItem(MATCH_MEMORY_KEY);
      setMatchMemory(null);
    } catch {
      // localStorage unavailable
    }
  };

  return {
    dockState,
    walletDetected,
    matchMemory: effectiveMatchMemory,
    greeting,
    markVisited,
    saveMatchMemory,
    clearMatchMemory,
  };
}
