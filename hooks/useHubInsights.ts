'use client';

/**
 * useHubInsights — Client hook for AI-generated Hub card insights.
 *
 * Fetches one-line insights with source citations for each Hub card.
 * Insights are cached server-side for 5 minutes and client-side via
 * TanStack Query with a 3-minute stale time.
 */

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useGovernanceMode } from '@/hooks/useGovernanceMode';
import { orderCardsByMode } from '@/lib/intelligence/hub-insights';
import type { HubInsight, HubInsightsResult } from '@/lib/intelligence/hub-insights';

async function fetchHubInsights(stakeAddress?: string | null): Promise<HubInsightsResult> {
  const url = stakeAddress
    ? `/api/intelligence/hub-insights?stakeAddress=${encodeURIComponent(stakeAddress)}`
    : '/api/intelligence/hub-insights';
  const res = await fetch(url);
  if (!res.ok) {
    return { insights: [], cardOrder: [], computedAt: new Date().toISOString() };
  }
  return res.json();
}

interface UseHubInsightsResult {
  /** Map of cardId -> insight for easy lookup */
  insightMap: Map<string, HubInsight>;
  /** Ordered card IDs based on temporal mode */
  getCardOrder: (cardIds: string[]) => string[];
  /** Whether insights are still loading */
  isLoading: boolean;
  /** Whether the AI hub feature is enabled */
  isEnabled: boolean;
}

export function useHubInsights(): UseHubInsightsResult {
  const { stakeAddress } = useSegment();
  const flagEnabled = useFeatureFlag('ai_composed_hub');
  const isEnabled = flagEnabled ?? false;
  const { mode } = useGovernanceMode();

  const { data, isLoading } = useQuery({
    queryKey: ['hub-insights', stakeAddress],
    queryFn: () => fetchHubInsights(stakeAddress),
    staleTime: 3 * 60 * 1000, // 3 minutes
    enabled: isEnabled,
  });

  const insightMap = new Map<string, HubInsight>();
  if (data?.insights) {
    for (const insight of data.insights) {
      // Only keep the first insight per card
      if (!insightMap.has(insight.cardId)) {
        insightMap.set(insight.cardId, insight);
      }
    }
  }

  const getCardOrder = (cardIds: string[]): string[] => {
    if (!isEnabled) return cardIds;
    return orderCardsByMode(cardIds, mode);
  };

  return {
    insightMap,
    getCardOrder,
    isLoading,
    isEnabled,
  };
}
