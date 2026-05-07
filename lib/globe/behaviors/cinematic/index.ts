import { createActionRequiredBehavior } from './actionRequiredBehavior';
import { createCivicEventTier0Behavior } from './civicEventTier0Behavior';
import { createFirstVisitAnonymousBehavior } from './firstVisitAnonymousBehavior';
import { createFirstVisitWalletConnectedBehavior } from './firstVisitWalletConnectedBehavior';
import { createReturningColdStartBehavior } from './returningColdStartBehavior';
import { createReturningEpochBehavior } from './returningEpochBehavior';
import { createReturningInSessionBehavior } from './returningInSessionBehavior';
import { createReturningQuietBehavior } from './returningQuietBehavior';
import { createReturningSignificantDeltaBehavior } from './returningSignificantDeltaBehavior';
import { createSentimentOpportunityBehavior } from './sentimentOpportunityBehavior';
import type { GlobeBehavior } from '@/lib/globe/behaviors/types';
import type { ConstellationRef } from '@/lib/globe/types';

export const CINEMATIC_BEHAVIOR_IDS = [
  'cinema:first_visit_anonymous',
  'cinema:first_visit_wallet_connected',
  'cinema:returning_in_session',
  'cinema:returning_quiet',
  'cinema:returning_significant_delta',
  'cinema:returning_epoch',
  'cinema:returning_cold_start',
  'cinema:civic_event_tier_0',
  'cinema:action_required',
  'cinema:sentiment_opportunity',
] as const;

export function createCinematicBehaviors(getGlobe: () => ConstellationRef | null): GlobeBehavior[] {
  return [
    createFirstVisitAnonymousBehavior(getGlobe),
    createFirstVisitWalletConnectedBehavior(getGlobe),
    createReturningInSessionBehavior(getGlobe),
    createReturningQuietBehavior(getGlobe),
    createReturningSignificantDeltaBehavior(getGlobe),
    createReturningEpochBehavior(getGlobe),
    createReturningColdStartBehavior(getGlobe),
    createCivicEventTier0Behavior(getGlobe),
    createActionRequiredBehavior(getGlobe),
    createSentimentOpportunityBehavior(getGlobe),
  ];
}
