'use client';

/**
 * Hook to fetch monitoring data for a submitted governance action.
 *
 * Uses TanStack Query with a 1-minute stale time and 5-minute auto-refetch
 * since voting data changes slowly (epoch-based).
 */

import { useQuery } from '@tanstack/react-query';
import type { ProposalMonitorData } from '@/lib/workspace/monitor-types';

// ---------------------------------------------------------------------------
// Fetch helper (same pattern as useDrafts.ts)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProposalMonitor(txHash: string | null, proposalIndex: number | null) {
  return useQuery<ProposalMonitorData>({
    queryKey: ['proposal-monitor', txHash, proposalIndex],
    queryFn: () =>
      fetchJson<ProposalMonitorData>(
        `/api/workspace/proposals/monitor?txHash=${encodeURIComponent(txHash!)}&proposalIndex=${proposalIndex}`,
      ),
    enabled: !!txHash && proposalIndex != null,
    staleTime: 60_000, // 1 minute
    refetchInterval: 300_000, // refetch every 5 minutes
  });
}
