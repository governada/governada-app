'use client';

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import type { ActionItem } from '@/lib/actionQueue';

/**
 * Fetches the unified action queue for the current user.
 * Polls every 60 seconds for fresh urgency data.
 */
export function useActionQueue() {
  const { segment, drepId, poolId } = useSegment();

  const params = new URLSearchParams({ segment });
  if (drepId) params.set('drepId', drepId);
  if (poolId) params.set('poolId', poolId);

  return useQuery<{ items: ActionItem[] }>({
    queryKey: ['action-queue', segment, drepId, poolId],
    queryFn: async () => {
      const res = await fetch(`/api/action-queue?${params}`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 60_000, // 60 seconds
    refetchInterval: 60_000,
    enabled: segment !== 'anonymous', // Anonymous users don't need the queue
  });
}
