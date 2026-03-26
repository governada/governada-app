'use client';

import { useMemo } from 'react';

interface AdaptiveDensity {
  level: 'calm' | 'active' | 'critical';
  showActionDock: boolean;
  showWhisper: boolean;
  showGauges: boolean;
  showRings: boolean;
}

type GpuQuality = 'low' | 'mid' | 'high';

export function useAdaptiveDensity(urgency: number, gpuQuality: GpuQuality): AdaptiveDensity {
  return useMemo(() => {
    // Low GPU: strip everything except rings
    if (gpuQuality === 'low') {
      return {
        level: 'calm' as const,
        showActionDock: false,
        showWhisper: false,
        showGauges: false,
        showRings: true,
      };
    }

    if (urgency >= 70) {
      return {
        level: 'critical' as const,
        showActionDock: true,
        showWhisper: true,
        showGauges: true,
        showRings: true,
      };
    }

    if (urgency >= 30) {
      return {
        level: 'active' as const,
        showActionDock: true,
        showWhisper: true,
        showGauges: true,
        showRings: true,
      };
    }

    // Calm: no action dock or whisper
    return {
      level: 'calm' as const,
      showActionDock: false,
      showWhisper: false,
      showGauges: true,
      showRings: true,
    };
  }, [urgency, gpuQuality]);
}
