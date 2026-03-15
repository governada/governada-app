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

/** Which sections are visible on the proposal detail page at each depth level */
export type ProposalSection =
  | 'hero'
  | 'actionZone'
  | 'intelligenceBriefing'
  | 'debate'
  | 'communitySignals'
  | 'lifecycle'
  | 'adoptionCurve'
  | 'voterTabs'
  | 'description'
  | 'similarProposals'
  | 'outcomeSection'
  | 'sourceMaterial';

const PROPOSAL_SECTIONS_HANDS_OFF: Record<ProposalSection, boolean> = {
  hero: true,
  actionZone: false,
  intelligenceBriefing: true,
  debate: false,
  communitySignals: false,
  lifecycle: false,
  adoptionCurve: false,
  voterTabs: false,
  description: false,
  similarProposals: false,
  outcomeSection: false,
  sourceMaterial: false,
};

const PROPOSAL_SECTIONS_INFORMED: Record<ProposalSection, boolean> = {
  hero: true,
  actionZone: true,
  intelligenceBriefing: true,
  debate: false,
  communitySignals: true,
  lifecycle: false,
  adoptionCurve: false,
  voterTabs: false,
  description: false,
  similarProposals: false,
  outcomeSection: false,
  sourceMaterial: false,
};

const PROPOSAL_SECTIONS_ENGAGED: Record<ProposalSection, boolean> = {
  hero: true,
  actionZone: true,
  intelligenceBriefing: true,
  debate: true,
  communitySignals: true,
  lifecycle: true,
  adoptionCurve: true,
  voterTabs: false,
  description: true,
  similarProposals: false,
  outcomeSection: true,
  sourceMaterial: false,
};

const PROPOSAL_SECTIONS_DEEP: Record<ProposalSection, boolean> = {
  hero: true,
  actionZone: true,
  intelligenceBriefing: true,
  debate: true,
  communitySignals: true,
  lifecycle: true,
  adoptionCurve: true,
  voterTabs: true,
  description: true,
  similarProposals: true,
  outcomeSection: true,
  sourceMaterial: true,
};

const GOVERNANCE_CONFIG = {
  hands_off: {
    showRationales: false,
    showHistoricalTrends: false,
    showDRepPosition: false,
    proposalDetail: 'headline' as const,
    proposalSections: PROPOSAL_SECTIONS_HANDS_OFF,
  },
  informed: {
    showRationales: false,
    showHistoricalTrends: false,
    showDRepPosition: true,
    proposalDetail: 'summary' as const,
    proposalSections: PROPOSAL_SECTIONS_INFORMED,
  },
  engaged: {
    showRationales: true,
    showHistoricalTrends: false,
    showDRepPosition: true,
    proposalDetail: 'full' as const,
    proposalSections: PROPOSAL_SECTIONS_ENGAGED,
  },
  deep: {
    showRationales: true,
    showHistoricalTrends: true,
    showDRepPosition: true,
    proposalDetail: 'full' as const,
    proposalSections: PROPOSAL_SECTIONS_DEEP,
  },
} as const satisfies Record<GovernanceDepth, object>;

const BRIEFING_CONFIG = {
  hands_off: {
    headlineLimit: 2,
    showNarrative: false,
    showVoice: false,
    showLookingAhead: false,
    showEngagement: false,
    treasuryDetail: 'balance_only' as const,
    drepDetail: 'score_verdict' as const,
  },
  informed: {
    headlineLimit: 3,
    showNarrative: true,
    showVoice: false,
    showLookingAhead: false,
    showEngagement: false,
    treasuryDetail: 'balance_runway' as const,
    drepDetail: 'score_verdict_change' as const,
  },
  engaged: {
    headlineLimit: 4,
    showNarrative: true,
    showVoice: true,
    showLookingAhead: true,
    showEngagement: true,
    treasuryDetail: 'full' as const,
    drepDetail: 'full' as const,
  },
  deep: {
    headlineLimit: 4,
    showNarrative: true,
    showVoice: true,
    showLookingAhead: true,
    showEngagement: true,
    treasuryDetail: 'full' as const,
    drepDetail: 'full' as const,
  },
} as const satisfies Record<GovernanceDepth, object>;

const HEALTH_CONFIG = {
  hands_off: {
    showTabs: false,
    availableTabs: [] as readonly string[],
    showActivityTicker: false,
    showTrends: false,
    showObservatory: false,
    alertLevel: 'none' as const,
    showGHIExplorerTrends: false,
    communityIntel: 'none' as const,
  },
  informed: {
    showTabs: true,
    availableTabs: ['now'] as readonly string[],
    showActivityTicker: false,
    showTrends: false,
    showObservatory: false,
    alertLevel: 'critical' as const,
    showGHIExplorerTrends: false,
    communityIntel: 'temperature' as const,
  },
  engaged: {
    showTabs: true,
    availableTabs: ['now', 'history'] as readonly string[],
    showActivityTicker: false,
    showTrends: false,
    showObservatory: false,
    alertLevel: 'full' as const,
    showGHIExplorerTrends: false,
    communityIntel: 'temperature' as const,
  },
  deep: {
    showTabs: true,
    availableTabs: ['now', 'history', 'observatory'] as readonly string[],
    showActivityTicker: true,
    showTrends: true,
    showObservatory: true,
    alertLevel: 'full' as const,
    showGHIExplorerTrends: true,
    communityIntel: 'all' as const,
  },
} as const satisfies Record<GovernanceDepth, object>;

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

type SurfaceConfigs = {
  hub: (typeof HUB_CONFIG)[GovernanceDepth];
  governance: (typeof GOVERNANCE_CONFIG)[GovernanceDepth];
  briefing: (typeof BRIEFING_CONFIG)[GovernanceDepth];
  health: (typeof HEALTH_CONFIG)[GovernanceDepth];
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
  const configs: {
    hub: typeof HUB_CONFIG;
    governance: typeof GOVERNANCE_CONFIG;
    briefing: typeof BRIEFING_CONFIG;
    health: typeof HEALTH_CONFIG;
  } = {
    hub: HUB_CONFIG,
    governance: GOVERNANCE_CONFIG,
    briefing: BRIEFING_CONFIG,
    health: HEALTH_CONFIG,
  };
  return configs[surface][depth] as SurfaceConfigs[S];
}
