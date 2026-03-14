'use client';

/**
 * FunnelExploreTracker — Fires the "explored governance" onboarding milestone.
 *
 * Drop this component into any governance sub-page to track that the user
 * has explored governance content, completing an onboarding checklist item.
 */

import { useEffect } from 'react';
import { getOnboardingState, updateOnboardingState } from '@/lib/funnel';

export function FunnelExploreTracker() {
  useEffect(() => {
    const state = getOnboardingState();
    if (!state.exploredGovernance) {
      updateOnboardingState({ exploredGovernance: true });
    }
  }, []);

  return null;
}
