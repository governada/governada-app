'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  type GovernancePassport,
  loadPassport,
  savePassport,
  createPassport,
} from '@/lib/passport';

/**
 * React hook for reading/writing the Governance Passport from localStorage.
 *
 * Provides `passport` state that stays synced with localStorage, plus an
 * `update` helper that merges partial updates and persists them.
 */
export function usePassport() {
  const [passport, setPassport] = useState<GovernancePassport | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadPassport();
    if (stored) {
      setPassport(stored);
    } else {
      const fresh = createPassport();
      savePassport(fresh);
      setPassport(fresh);
    }
    setLoaded(true);
  }, []);

  /** Merge partial updates into the passport and persist. */
  const update = useCallback((partial: Partial<GovernancePassport>) => {
    setPassport((prev) => {
      const current = prev ?? createPassport();
      const updated = { ...current, ...partial };
      savePassport(updated);
      return updated;
    });
  }, []);

  /** Reset the passport to a fresh stage 1 state. */
  const reset = useCallback(() => {
    const fresh = createPassport();
    savePassport(fresh);
    setPassport(fresh);
  }, []);

  return { passport, loaded, update, reset };
}
