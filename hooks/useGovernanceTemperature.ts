'use client';

/**
 * useGovernanceTemperature — Maps live governance temperature score to a CSS color
 * for the ambient governance tint on the constellation globe.
 *
 * Temperature ranges:
 * - Cool blue   (<30):  Quiet governance period. Calm, serene.
 * - Neutral     (30-60): Normal activity. Default appearance.
 * - Warm amber  (60-80): Active governance. Increased proposal volume.
 * - Urgent red  (>80):  Intense governance moment. Contested votes.
 *
 * Returns a CSS color value for the `--governance-tint` custom property,
 * applied as a subtle (10-15% opacity) overlay on the constellation container.
 *
 * Fetches live data from GET /api/intelligence/governance-state, cached 60s.
 */

import { useQuery } from '@tanstack/react-query';
import type { GovernanceStateResult } from '@/lib/intelligence/governance-state';

export interface GovernanceTemperatureResult {
  /** Governance temperature score (0-100) */
  temperature: number;
  /** CSS color for the governance tint overlay */
  tintColor: string;
  /** Human-readable label for the current state */
  label: 'cool' | 'neutral' | 'warm' | 'urgent';
  /** Whether the data is still loading */
  isLoading: boolean;
}

/**
 * Map temperature score to a CSS color and label.
 */
function temperatureToTint(temperature: number): {
  color: string;
  label: GovernanceTemperatureResult['label'];
} {
  if (temperature > 80) {
    return { color: 'rgba(239, 68, 68, 0.12)', label: 'urgent' };
  }
  if (temperature > 60) {
    return { color: 'rgba(245, 158, 11, 0.10)', label: 'warm' };
  }
  if (temperature >= 30) {
    return { color: 'rgba(148, 163, 184, 0.05)', label: 'neutral' };
  }
  return { color: 'rgba(56, 189, 248, 0.10)', label: 'cool' };
}

async function fetchGovernanceState(): Promise<GovernanceStateResult> {
  const res = await fetch('/api/intelligence/governance-state');
  if (!res.ok) throw new Error(`Governance state fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Returns the governance temperature color for ambient tinting.
 * Falls back to neutral (temperature 50) while loading or on error.
 */
export function useGovernanceTemperature(): GovernanceTemperatureResult {
  const { data, isLoading } = useQuery({
    queryKey: ['governance-state'],
    queryFn: fetchGovernanceState,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  const temperature = data?.temperature ?? 50;
  const { color, label } = temperatureToTint(temperature);

  return {
    temperature,
    tintColor: color,
    label,
    isLoading,
  };
}
