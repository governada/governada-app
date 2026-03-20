'use client';

/**
 * useGovernanceMode — Returns the current governance temporal mode.
 *
 * Modes:
 * - 'urgent': Multiple proposals expiring within 48h, or epoch ending with uncast DRep votes
 *             (urgency score >= 70)
 * - 'active':  Active proposals in voting, normal governance activity
 *             (urgency score 40-69)
 * - 'calm':    No urgent proposals, analysis/research period
 *             (urgency score < 40)
 *
 * Fetches live data from GET /api/intelligence/governance-state, cached 60s.
 */

import { useQuery } from '@tanstack/react-query';
import type { GovernanceStateResult } from '@/lib/intelligence/governance-state';

export type GovernanceMode = 'urgent' | 'active' | 'calm';

interface UseGovernanceModeResult {
  /** Current governance temporal mode */
  mode: GovernanceMode;
  /** Convenience boolean for urgent state checks */
  isUrgent: boolean;
  /** Convenience boolean for calm state checks */
  isCalm: boolean;
  /** Raw urgency score (0-100) */
  urgencyScore: number;
  /** Whether the data is still loading (returns safe defaults while loading) */
  isLoading: boolean;
}

/**
 * Derive mode from urgency score.
 */
function scoreToMode(score: number): GovernanceMode {
  if (score >= 70) return 'urgent';
  if (score >= 40) return 'active';
  return 'calm';
}

async function fetchGovernanceState(): Promise<GovernanceStateResult> {
  const res = await fetch('/api/intelligence/governance-state');
  if (!res.ok) throw new Error(`Governance state fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Returns the current governance temporal mode based on live governance urgency.
 * Falls back to 'active' (urgency 50) while loading or on error.
 */
export function useGovernanceMode(): UseGovernanceModeResult {
  const { data, isLoading } = useQuery({
    queryKey: ['governance-state'],
    queryFn: fetchGovernanceState,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  const urgencyScore = data?.urgency ?? 50;
  const mode = scoreToMode(urgencyScore);

  return {
    mode,
    isUrgent: mode === 'urgent',
    isCalm: mode === 'calm',
    urgencyScore,
    isLoading,
  };
}
