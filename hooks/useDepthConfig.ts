'use client';

import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import type { GovernanceDepth } from '@/lib/governanceTuner';

// ---------------------------------------------------------------------------
// Per-surface depth configurations
// ---------------------------------------------------------------------------

const HUB_CONFIG = {
  hands_off: {
    maxSections: 3,
    showFootprint: false,
    showSentiment: false,
    showAnalytics: false,
    proposalLimit: 2,
  },
  informed: {
    maxSections: 5,
    showFootprint: true,
    showSentiment: false,
    showAnalytics: false,
    proposalLimit: 4,
  },
  engaged: {
    maxSections: 8,
    showFootprint: true,
    showSentiment: true,
    showAnalytics: false,
    proposalLimit: 8,
  },
  deep: {
    maxSections: 99,
    showFootprint: true,
    showSentiment: true,
    showAnalytics: true,
    proposalLimit: 99,
  },
} as const satisfies Record<GovernanceDepth, object>;

const GOVERNANCE_CONFIG = {
  hands_off: {
    showRationales: false,
    showHistoricalTrends: false,
    showDRepPosition: false,
    proposalDetail: 'headline' as const,
  },
  informed: {
    showRationales: false,
    showHistoricalTrends: false,
    showDRepPosition: true,
    proposalDetail: 'summary' as const,
  },
  engaged: {
    showRationales: true,
    showHistoricalTrends: false,
    showDRepPosition: true,
    proposalDetail: 'full' as const,
  },
  deep: {
    showRationales: true,
    showHistoricalTrends: true,
    showDRepPosition: true,
    proposalDetail: 'full' as const,
  },
} as const satisfies Record<GovernanceDepth, object>;

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

type SurfaceConfigs = {
  hub: (typeof HUB_CONFIG)[GovernanceDepth];
  governance: (typeof GOVERNANCE_CONFIG)[GovernanceDepth];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns depth-specific configuration for a given surface.
 *
 * To add depth-awareness to a new page, add a config object above and
 * extend the SurfaceConfigs type. No other files need to change.
 */
export function useDepthConfig<S extends keyof SurfaceConfigs>(surface: S): SurfaceConfigs[S] {
  const { depth } = useGovernanceDepth();
  const configs: { hub: typeof HUB_CONFIG; governance: typeof GOVERNANCE_CONFIG } = {
    hub: HUB_CONFIG,
    governance: GOVERNANCE_CONFIG,
  };
  return configs[surface][depth] as SurfaceConfigs[S];
}
