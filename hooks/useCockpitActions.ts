'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useCockpitStore } from '@/stores/cockpitStore';
import { OVERLAY_CONFIGS } from '@/lib/cockpit/overlayConfigs';
import type { ActionItem } from '@/lib/actionQueue';
import type { ActionRailItem } from '@/lib/cockpit/types';

// ---------------------------------------------------------------------------
// Action label + globe node mapping
// ---------------------------------------------------------------------------

function mapToRailItem(item: ActionItem): ActionRailItem {
  let actionLabel: string;
  let globeNodeId: string | undefined;

  switch (item.type) {
    case 'pending_vote': {
      actionLabel = 'Review \u2192';
      // Extract proposal path from href like /proposal/{txHash}/{index}
      const match = item.href.match(/\/proposal\/([^/]+)\/(\d+)/);
      if (match) {
        globeNodeId = `proposal-${match[1]}-${match[2]}`;
      }
      break;
    }
    case 'delegation_alert':
      actionLabel = 'Compare \u2192';
      break;
    case 'score_alert':
      actionLabel = 'Improve \u2192';
      break;
    case 'match_cta':
      actionLabel = 'Match \u2192';
      break;
    default:
      actionLabel = 'View \u2192';
      break;
  }

  return { ...item, actionLabel, globeNodeId };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Enhanced action queue hook for the Cockpit homepage.
 *
 * - Fetches action items via TanStack Query
 * - Maps items to ActionRailItem with globe node IDs and action labels
 * - Filters by active overlay's railFilter config
 * - Re-fetches on window focus to detect completed items
 */
export function useCockpitActions(): {
  items: ActionRailItem[];
  allItems: ActionRailItem[];
  isLoading: boolean;
  urgentCount: number;
} {
  const { segment, drepId, poolId, stakeAddress, delegatedDrep } = useSegment();
  const activeOverlay = useCockpitStore((s) => s.activeOverlay);
  const actionCompletions = useCockpitStore((s) => s.actionCompletions);
  const queryClient = useQueryClient();
  const prevIdsRef = useRef<Set<string>>(new Set());

  // Build query params
  const params = new URLSearchParams({ segment });
  if (drepId) params.set('drepId', drepId);
  if (poolId) params.set('poolId', poolId);
  if (stakeAddress) params.set('stakeAddress', stakeAddress);
  if (delegatedDrep) params.set('delegatedDrepId', delegatedDrep);

  const { data, isLoading } = useQuery<{ items: ActionItem[] }>({
    queryKey: ['cockpit-actions', segment, drepId, poolId, delegatedDrep],
    queryFn: async () => {
      const res = await fetch(`/api/action-queue?${params}`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: segment !== 'anonymous',
  });

  // Track completions on window focus — re-fetch and diff
  const detectCompletions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cockpit-actions'] });
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener('focus', detectCompletions);
    return () => window.removeEventListener('focus', detectCompletions);
  }, [detectCompletions]);

  // Detect newly completed items when data changes
  const completeAction = useCockpitStore((s) => s.completeAction);

  useEffect(() => {
    if (!data?.items) return;
    const currentIds = new Set(data.items.map((i) => i.id));

    // Items that were in previous set but gone now = completed
    for (const prevId of prevIdsRef.current) {
      if (!currentIds.has(prevId) && !actionCompletions[prevId]) {
        completeAction(prevId);
      }
    }

    prevIdsRef.current = currentIds;
  }, [data?.items, actionCompletions, completeAction]);

  // Map and filter
  const allItems = (data?.items ?? []).map(mapToRailItem);

  // Apply overlay filter
  const overlayConfig = OVERLAY_CONFIGS[activeOverlay];
  const railFilter = overlayConfig.railFilter;

  const filtered = railFilter
    ? allItems.filter((item) => railFilter.includes(item.priority))
    : allItems;

  // Exclude items that finished their completion animation
  const visible = filtered.filter((item) => actionCompletions[item.id] !== 'done');

  // Cap at 5
  const items = visible.slice(0, 5);

  const urgentCount = allItems.filter((i) => i.priority === 'urgent').length;

  return { items, allItems, isLoading, urgentCount };
}
