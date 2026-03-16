'use client';

import { useQuery } from '@tanstack/react-query';

export interface TreasuryContextData {
  balance: number;
  epoch: number;
  snapshotAt: string;
  runwayMonths: number;
  burnRatePerEpoch: number;
  trend: 'growing' | 'shrinking' | 'stable';
  healthScore: number | null;
  healthComponents: Record<string, number> | null;
  pendingCount: number;
  pendingTotalAda: number;
}

async function fetchTreasuryContext(): Promise<TreasuryContextData> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch('/api/treasury/current', { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch current treasury context for the review workspace.
 * staleTime: 5 minutes (treasury data changes per epoch, not per second).
 */
export function useTreasuryContext() {
  return useQuery<TreasuryContextData>({
    queryKey: ['treasury-context'],
    queryFn: fetchTreasuryContext,
    staleTime: 5 * 60 * 1000,
  });
}
