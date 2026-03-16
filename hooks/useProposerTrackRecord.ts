'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProposerTrackRecord } from '@/lib/workspace/types';

async function fetchProposerTrackRecord(
  txHash: string,
  index: number,
): Promise<ProposerTrackRecord> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(
    `/api/workspace/proposer-track-record?txHash=${encodeURIComponent(txHash)}&index=${index}`,
    { headers },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch the proposer's track record for a given proposal.
 * Looks up the proposal author via meta_json and aggregates their history.
 */
export function useProposerTrackRecord(txHash: string | null | undefined, index: number) {
  return useQuery<ProposerTrackRecord>({
    queryKey: ['proposer-track-record', txHash, index],
    queryFn: () => fetchProposerTrackRecord(txHash!, index),
    enabled: !!txHash,
    staleTime: 5 * 60 * 1000,
  });
}
