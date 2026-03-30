'use client';

import { useQuery } from '@tanstack/react-query';
import type { GovernanceStateResult } from '@/lib/intelligence/governance-state';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getStoredSession } from '@/lib/supabaseAuth';

async function fetchGovernanceState(stakeAddress?: string): Promise<GovernanceStateResult> {
  const params = stakeAddress ? `?stakeAddress=${stakeAddress}` : '';
  const headers: Record<string, string> = {};
  const token = getStoredSession();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/intelligence/governance-state${params}`, { headers });
  if (!res.ok) throw new Error(`Governance state fetch failed: ${res.status}`);
  return res.json();
}

/**
 * useGovernanceState — Fetch governance state with optional user context.
 *
 * Returns urgency, temperature, epoch info, and user-specific state
 * (pending votes, DRep score, delegated DRep, etc.) when authenticated.
 *
 * Uses a separate query key from useGovernanceTemperature (which fetches
 * without stakeAddress) since user-specific data requires authentication.
 */
export function useGovernanceState() {
  const { stakeAddress } = useSegment();

  const { data, isLoading } = useQuery({
    queryKey: ['governance-state', stakeAddress ?? 'anonymous'],
    queryFn: () => fetchGovernanceState(stakeAddress ?? undefined),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  return {
    data: data ?? null,
    userState: data?.userState ?? null,
    epoch: data?.epoch ?? null,
    urgency: data?.urgency ?? 0,
    temperature: data?.temperature ?? 50,
    isLoading,
  };
}
