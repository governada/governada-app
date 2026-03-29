'use client';

/**
 * Hook to fetch cached personalized briefing for a specific voter + proposal.
 *
 * Returns the cached result if available, or null. The PersonalizedSummary
 * component uses this to skip the AI call on repeat visits.
 */

import { useQuery } from '@tanstack/react-query';

async function fetchReviewerCache(
  voterId: string,
  txHash: string,
  index: number,
): Promise<unknown | null> {
  const params = new URLSearchParams({
    voterId,
    txHash,
    index: String(index),
  });
  const res = await fetch(`/api/workspace/reviewer-cache?${params}`);
  if (!res.ok) throw new Error('Failed to fetch reviewer cache');
  return res.json();
}

export function useReviewerCache(
  voterId: string | undefined,
  txHash: string | undefined,
  index: number | undefined,
) {
  return useQuery({
    queryKey: ['reviewer-cache', voterId, txHash, index],
    queryFn: () => fetchReviewerCache(voterId!, txHash!, index!),
    enabled: !!voterId && !!txHash && index != null,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

/**
 * Write-through: save a personalized briefing to the cache after AI generation.
 */
export async function writeReviewerCache(
  voterId: string,
  txHash: string,
  index: number,
  content: unknown,
): Promise<void> {
  try {
    await fetch('/api/workspace/reviewer-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId, txHash, index, content }),
    });
  } catch {
    // Fire-and-forget — cache write failure shouldn't break the UI
  }
}
