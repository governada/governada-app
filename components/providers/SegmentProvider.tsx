'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useWallet } from '@/utils/wallet-context';
import type { DimensionOverrides } from '@/lib/admin/viewAsRegistry';
import type { EngagementLevel } from '@/lib/citizen/engagementLevel';
import type { CredibilityTier } from '@/lib/citizenCredibility';
import type { GovernanceLevel } from '@/lib/governanceLevels';
import type { GovernanceDepth } from '@/lib/governanceTuner';

export type UserSegment = 'anonymous' | 'citizen' | 'spo' | 'drep' | 'cc';

export interface SegmentOverride {
  segment: UserSegment;
  drepId?: string | null;
  poolId?: string | null;
  delegatedDrep?: string | null;
  delegatedPool?: string | null;
}

export interface SegmentState {
  segment: UserSegment;
  realSegment: UserSegment;
  isLoading: boolean;
  stakeAddress: string | null;
  drepId: string | null;
  poolId: string | null;
  delegatedDrep: string | null;
  delegatedPool: string | null;
  /** Score tier for DRep/SPO segments (e.g. 'Gold', 'Diamond') */
  tier: string | null;
  setOverride: (override: SegmentOverride | null) => void;
  /** Cross-cutting dimension overrides (admin only) */
  dimensionOverrides: DimensionOverrides;
  setDimensionOverrides: (overrides: DimensionOverrides) => void;
  /** Convenience: check if a specific dimension is overridden */
  getEngagementLevelOverride: () => EngagementLevel | null;
  getCredibilityTierOverride: () => CredibilityTier | null;
  getGovernanceLevelOverride: () => GovernanceLevel | null;
  getGovernanceDepthOverride: () => GovernanceDepth | null;
  /** True when admin "View As" override is active — components should show preview mode */
  isViewingAs: boolean;
}

const STORAGE_KEY = 'governada_segment';

const noop = () => {};
const noopDimensions = () => {};

const DEFAULT_STATE: SegmentState = {
  segment: 'anonymous',
  realSegment: 'anonymous',
  isLoading: false,
  stakeAddress: null,
  drepId: null,
  poolId: null,
  delegatedDrep: null,
  delegatedPool: null,
  tier: null,
  setOverride: noop,
  dimensionOverrides: {},
  setDimensionOverrides: noopDimensions,
  getEngagementLevelOverride: () => null,
  getCredibilityTierOverride: () => null,
  getGovernanceLevelOverride: () => null,
  getGovernanceDepthOverride: () => null,
  isViewingAs: false,
};

const SegmentContext = createContext<SegmentState>(DEFAULT_STATE);

interface CachedSegment {
  segment: UserSegment;
  stakeAddress: string | null;
  drepId: string | null;
  poolId: string | null;
  delegatedDrep: string | null;
  delegatedPool: string | null;
  tier: string | null;
}

function loadCached(stakeAddress: string): CachedSegment | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSegment & { _addr: string };
    if (cached._addr === stakeAddress) return cached;
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveCache(state: CachedSegment, stakeAddress: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _addr: stakeAddress }));
  } catch {
    // Storage full or unavailable
  }
}

export function SegmentProvider({ children }: { children: ReactNode }) {
  const { connected, isAuthenticated, address } = useWallet();
  const [detected, setDetected] = useState<
    Omit<
      SegmentState,
      | 'segment'
      | 'realSegment'
      | 'setOverride'
      | 'dimensionOverrides'
      | 'setDimensionOverrides'
      | 'getEngagementLevelOverride'
      | 'getCredibilityTierOverride'
      | 'getGovernanceLevelOverride'
      | 'getGovernanceDepthOverride'
      | 'isViewingAs'
    >
  >({
    isLoading: false,
    stakeAddress: null,
    drepId: null,
    poolId: null,
    delegatedDrep: null,
    delegatedPool: null,
    tier: null,
  });
  const [detectedSegment, setDetectedSegment] = useState<UserSegment>('anonymous');
  const [override, setOverride] = useState<SegmentOverride | null>(null);
  const [dimensionOverrides, setDimensionOverrides] = useState<DimensionOverrides>({});

  const detect = useCallback(async (stakeAddress: string) => {
    const cached = loadCached(stakeAddress);
    if (cached) {
      setDetectedSegment(cached.segment);
      setDetected({
        isLoading: false,
        stakeAddress: cached.stakeAddress,
        drepId: cached.drepId,
        poolId: cached.poolId,
        delegatedDrep: cached.delegatedDrep,
        delegatedPool: cached.delegatedPool,
        tier: cached.tier ?? null,
      });
      return;
    }

    setDetected((s) => ({ ...s, isLoading: true }));

    try {
      const res = await fetch(`/api/user/detect-segment?stakeAddress=${stakeAddress}`);
      if (!res.ok) throw new Error('detect-segment failed');

      const data = await res.json();
      const seg: UserSegment = data.segment ?? 'citizen';
      setDetectedSegment(seg);
      const next = {
        isLoading: false,
        stakeAddress,
        drepId: data.drepId ?? null,
        poolId: data.poolId ?? null,
        delegatedDrep: data.delegatedDrep ?? null,
        delegatedPool: data.delegatedPool ?? null,
        tier: data.tier ?? null,
      };
      setDetected(next);
      saveCache({ ...next, segment: seg }, stakeAddress);
    } catch {
      setDetected((s) => ({ ...s, isLoading: false }));
      setDetectedSegment('citizen');
    }
  }, []);

  useEffect(() => {
    // Detect segment when wallet is connected (address available),
    // not just when fully authenticated (nonce signed)
    if ((!connected && !isAuthenticated) || !address) {
      setDetected({
        isLoading: false,
        stakeAddress: null,
        drepId: null,
        poolId: null,
        delegatedDrep: null,
        delegatedPool: null,
        tier: null,
      });
      setDetectedSegment('anonymous');
      setOverride(null);
      setDimensionOverrides({});
      return;
    }
    detect(address);
  }, [connected, isAuthenticated, address, detect]);

  const value: SegmentState = {
    ...detected,
    segment: override?.segment ?? detectedSegment,
    realSegment: detectedSegment,
    drepId: override && 'drepId' in override ? (override.drepId ?? null) : detected.drepId,
    poolId: override && 'poolId' in override ? (override.poolId ?? null) : detected.poolId,
    delegatedDrep:
      override && 'delegatedDrep' in override
        ? (override.delegatedDrep ?? null)
        : detected.delegatedDrep,
    delegatedPool:
      override && 'delegatedPool' in override
        ? (override.delegatedPool ?? null)
        : detected.delegatedPool,
    setOverride,
    dimensionOverrides,
    setDimensionOverrides,
    getEngagementLevelOverride: () => dimensionOverrides.engagementLevel ?? null,
    getCredibilityTierOverride: () => dimensionOverrides.credibilityTier ?? null,
    getGovernanceLevelOverride: () => dimensionOverrides.governanceLevel ?? null,
    getGovernanceDepthOverride: () => dimensionOverrides.governanceDepth ?? null,
    isViewingAs: override !== null,
  };

  return <SegmentContext.Provider value={value}>{children}</SegmentContext.Provider>;
}

export function useSegment(): SegmentState {
  return useContext(SegmentContext);
}
