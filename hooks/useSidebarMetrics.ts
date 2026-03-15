'use client';

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';

/**
 * Fetches sidebar sub-label metrics via /api/sidebar-metrics.
 * Returns a Record<sublabelKey, displayString> for the Living Sidebar.
 *
 * Polls every 30 seconds. Returns empty map while loading/error.
 */
export function useSidebarMetrics(): Record<string, string> {
  const { segment, drepId, poolId, stakeAddress } = useSegment();

  const params = new URLSearchParams();
  if (drepId) params.set('drepId', drepId);
  if (poolId) params.set('poolId', poolId);
  if (stakeAddress) params.set('stakeAddress', stakeAddress);

  const queryString = params.toString();
  const url = queryString ? `/api/sidebar-metrics?${queryString}` : '/api/sidebar-metrics';

  const { data } = useQuery<Record<string, string>>({
    queryKey: ['sidebar-metrics', segment, drepId, poolId, stakeAddress],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 30_000, // 30 seconds
    refetchInterval: 30_000,
    // Graceful: return empty map on error, don't show stale errors
    placeholderData: {},
  });

  return data ?? {};
}
