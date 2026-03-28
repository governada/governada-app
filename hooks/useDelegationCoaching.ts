'use client';

/**
 * useDelegationCoaching ��� Fetches comparative delegation coaching insights.
 *
 * Shows insights like "Citizens with similar values delegated to DRep X."
 * Only fires for authenticated users on delegation-relevant pages.
 */

import { useQuery } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';

interface CoachingSuggestedDrep {
  drepId: string;
  name: string;
  score: number;
  matchPercent: number;
}

export interface CoachingInsight {
  id: string;
  type: 'better_match' | 'rebalance' | 'confirmation';
  text: string;
  variant: 'info' | 'warning' | 'success' | 'neutral';
  suggestedDrep?: CoachingSuggestedDrep;
  provenance: Array<{ label: string; detail: string }>;
}

interface CoachingResponse {
  insights: CoachingInsight[];
  cohortSize: number;
}

export function useDelegationCoaching(enabled = true) {
  const { data, isLoading, error } = useQuery<CoachingResponse>({
    queryKey: ['delegation-coaching'],
    queryFn: async () => {
      const token = getStoredSession();
      if (!token) return { insights: [], cohortSize: 0 };

      const res = await fetch('/api/intelligence/delegation-coaching', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { insights: [], cohortSize: 0 };
      return res.json();
    },
    enabled,
    staleTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    insights: data?.insights ?? [],
    cohortSize: data?.cohortSize ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}
