'use client';

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';

interface HudData {
  urgencyLevel: 'calm' | 'active' | 'critical';
  rings: { participation: number; deliberation: number; impact: number };
  epochProgress: number;
  epochNumber: number;
  gauges: {
    treasury: { label: string; trend: 'up' | 'down' | 'flat' } | null;
    ghi: { score: number; label: string } | null;
    activeProposals: { count: number; critical: number } | null;
  };
  isLoading: boolean;
}

function parseGhiScore(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function parseActiveProposals(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseTrend(raw: string | undefined): 'up' | 'down' | 'flat' {
  if (!raw) return 'flat';
  if (raw.includes('\u2191') || raw.includes('up')) return 'up';
  if (raw.includes('\u2193') || raw.includes('down')) return 'down';
  return 'flat';
}

function toUrgencyLevel(urgency: number): 'calm' | 'active' | 'critical' {
  if (urgency >= 70) return 'critical';
  if (urgency >= 30) return 'active';
  return 'calm';
}

export function useHudData(): HudData {
  const { segment, stakeAddress, drepId, poolId, delegatedDrep } = useSegment();

  const metricsQuery = useQuery({
    queryKey: ['sidebar-metrics'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (segment) params.set('segment', segment);
      if (stakeAddress) params.set('stakeAddress', stakeAddress);
      if (drepId) params.set('drepId', drepId);
      if (poolId) params.set('poolId', poolId);
      if (delegatedDrep) params.set('delegatedDrep', delegatedDrep);

      const res = await fetch(`/api/sidebar-metrics?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch sidebar metrics');
      return res.json() as Promise<Record<string, string>>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const narrativeQuery = useQuery({
    queryKey: ['homepage-narrative'],
    queryFn: async () => {
      const res = await fetch('/api/homepage/narrative');
      if (!res.ok) throw new Error('Failed to fetch homepage narrative');
      return res.json() as Promise<{
        healthScore?: number;
        urgency?: number;
        epochNumber?: number;
        epochProgress?: number;
        [key: string]: unknown;
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const metrics = metricsQuery.data;
  const narrative = narrativeQuery.data;

  const ghiScoreRaw = parseGhiScore(metrics?.['gov.ghiScore']);
  const ghiFromNarrative = narrative?.healthScore ?? null;
  const ghiScore = ghiScoreRaw ?? ghiFromNarrative;

  const activeCount = parseActiveProposals(metrics?.['gov.activeProposals']);
  const treasuryLabel = metrics?.['gov.treasuryBalance'] ?? null;
  const treasuryTrend = parseTrend(metrics?.['gov.treasuryBalance']);

  const urgencyRaw = narrative?.urgency ?? 0;
  const urgencyLevel = toUrgencyLevel(urgencyRaw);

  const epochNumber = narrative?.epochNumber ?? 0;
  const epochProgress = narrative?.epochProgress ?? 0.5;

  return {
    urgencyLevel,
    rings: {
      participation: 45,
      deliberation: 30,
      impact: 20,
    },
    epochProgress,
    epochNumber,
    gauges: {
      treasury: treasuryLabel ? { label: treasuryLabel, trend: treasuryTrend } : null,
      ghi: ghiScore != null ? { score: ghiScore, label: 'GHI' } : null,
      activeProposals: activeCount != null ? { count: activeCount, critical: 0 } : null,
    },
    isLoading: metricsQuery.isLoading || narrativeQuery.isLoading,
  };
}
