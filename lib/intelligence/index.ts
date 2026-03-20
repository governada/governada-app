/**
 * Intelligence Pipeline — barrel export.
 *
 * Provides navigation-consumable APIs that wire existing intelligence signals
 * (alignment vectors, scoring, GHI, embeddings) into the Co-Pilot and AI Hub.
 */

export { computeGovernanceState } from './governance-state';
export type { GovernanceStateResult, EpochContext, UserGovernanceState } from './governance-state';

export { synthesizeContext } from './context';
export type {
  ContextSynthesisInput,
  ContextSynthesisResult,
  ContextHighlight,
  SuggestedAction,
} from './context';

export { computePriority } from './priority';
export type { PriorityProposal, PriorityResult } from './priority';

export { generateHubInsights, orderCardsByMode } from './hub-insights';
export type { HubInsight, InsightCitation, HubInsightsResult } from './hub-insights';
