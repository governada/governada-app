'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useWallet } from '@/utils/wallet';

export type UserSegment = 'anonymous' | 'citizen' | 'spo' | 'drep';

export interface SegmentState {
  segment: UserSegment;
  isLoading: boolean;
  stakeAddress: string | null;
  drepId: string | null;
  poolId: string | null;
  delegatedDrep: string | null;
  delegatedPool: string | null;
}

const STORAGE_KEY = 'civica_segment';

const DEFAULT_STATE: SegmentState = {
  segment: 'anonymous',
  isLoading: false,
  stakeAddress: null,
  drepId: null,
  poolId: null,
  delegatedDrep: null,
  delegatedPool: null,
};

const SegmentContext = createContext<SegmentState>(DEFAULT_STATE);

function loadCached(stakeAddress: string): SegmentState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as SegmentState & { _addr: string };
    if (cached._addr === stakeAddress) return cached;
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveCache(state: SegmentState, stakeAddress: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _addr: stakeAddress }));
  } catch {
    // Storage full or unavailable
  }
}

export function SegmentProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, address } = useWallet();
  const [state, setState] = useState<SegmentState>(DEFAULT_STATE);

  const detect = useCallback(async (stakeAddress: string) => {
    const cached = loadCached(stakeAddress);
    if (cached) {
      setState(cached);
      return;
    }

    setState((s) => ({ ...s, isLoading: true }));

    try {
      const res = await fetch(`/api/user/detect-segment?stakeAddress=${stakeAddress}`);
      if (!res.ok) throw new Error('detect-segment failed');

      const data = await res.json();
      const next: SegmentState = {
        segment: data.segment ?? 'citizen',
        isLoading: false,
        stakeAddress,
        drepId: data.drepId ?? null,
        poolId: data.poolId ?? null,
        delegatedDrep: data.delegatedDrep ?? null,
        delegatedPool: data.delegatedPool ?? null,
      };
      setState(next);
      saveCache(next, stakeAddress);
    } catch {
      setState((s) => ({ ...s, isLoading: false, segment: 'citizen' }));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !address) {
      setState(DEFAULT_STATE);
      return;
    }
    detect(address);
  }, [isAuthenticated, address, detect]);

  return <SegmentContext.Provider value={state}>{children}</SegmentContext.Provider>;
}

export function useSegment(): SegmentState {
  return useContext(SegmentContext);
}
