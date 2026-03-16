'use client';

import { useQuery } from '@tanstack/react-query';
import type { PerspectiveClustersData } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/** Fetch perspective clusters for a proposal */
export function usePerspectives(txHash: string | null, index: number | null) {
  return useQuery<{ data: PerspectiveClustersData | null }>({
    queryKey: ['perspective-clusters', txHash, index],
    queryFn: () =>
      fetchJson(`/api/workspace/perspectives?txHash=${encodeURIComponent(txHash!)}&index=${index}`),
    enabled: !!txHash && index != null,
    staleTime: 5 * 60 * 1000, // 5 minutes — clusters don't change often
  });
}
