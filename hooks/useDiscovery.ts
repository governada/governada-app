'use client';

/**
 * useDiscovery — React hook wrapping the discovery state engine.
 *
 * Provides reactive state + action methods for the Discovery Layer.
 * Re-renders when state changes via a simple version counter.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  getDiscoveryState,
  markSectionVisited as _markSectionVisited,
  startTour as _startTour,
  advanceTourStep as _advanceTourStep,
  completeTour as _completeTour,
  cancelTour as _cancelTour,
  markFeatureExplored as _markFeatureExplored,
  markHubOpened as _markHubOpened,
  markMilestoneCelebrated as _markMilestoneCelebrated,
  type DiscoveryState,
} from '@/lib/discovery/state';
import {
  getToursForSegment,
  getSectionTours,
  getFeaturesForSegment,
  getFeaturesByCategory,
  getTourById,
  type UserSegment,
  type SectionId,
} from '@/lib/discovery/content';

export function useDiscovery() {
  const { segment } = useSegment();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Read state reactively (re-reads on version bump)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version drives re-reads
  const state: DiscoveryState = useMemo(() => getDiscoveryState(), [version]);

  const userSegment = (segment ?? 'anonymous') as UserSegment;

  // Filtered content for current persona
  const tours = useMemo(() => getToursForSegment(userSegment), [userSegment]);
  const features = useMemo(() => getFeaturesForSegment(userSegment), [userSegment]);
  const featuresByCategory = useMemo(() => getFeaturesByCategory(userSegment), [userSegment]);

  // Progress
  const explorationProgress = useMemo(() => {
    const total = features.length;
    const explored = state.featuresExplored.length;
    return {
      explored,
      total,
      percent: total > 0 ? Math.round((explored / total) * 100) : 0,
    };
  }, [features.length, state.featuresExplored.length]);

  // Actions (all trigger a refresh)
  const markSectionVisited = useCallback(
    (section: string) => {
      const isFirst = _markSectionVisited(section);
      refresh();
      return isFirst;
    },
    [refresh],
  );

  const startTour = useCallback(
    (tourId: string) => {
      _startTour(tourId);
      refresh();
    },
    [refresh],
  );

  const advanceTourStep = useCallback(() => {
    const nextIndex = _advanceTourStep();
    const tour = state.tourInProgress ? getTourById(state.tourInProgress) : null;
    if (tour && nextIndex >= tour.steps.length) {
      _completeTour();
    }
    refresh();
    return nextIndex;
  }, [state.tourInProgress, refresh]);

  const completeTour = useCallback(() => {
    _completeTour();
    refresh();
  }, [refresh]);

  const cancelTour = useCallback(() => {
    _cancelTour();
    refresh();
  }, [refresh]);

  const markFeatureExplored = useCallback(
    (featureId: string) => {
      _markFeatureExplored(featureId);
      refresh();
    },
    [refresh],
  );

  const markHubOpened = useCallback(() => {
    _markHubOpened();
    refresh();
  }, [refresh]);

  const markMilestoneCelebrated = useCallback(
    (milestoneId: string) => {
      _markMilestoneCelebrated(milestoneId);
      refresh();
    },
    [refresh],
  );

  // Current tour info
  const activeTour = useMemo(
    () => (state.tourInProgress ? getTourById(state.tourInProgress) : null),
    [state.tourInProgress],
  );

  const currentStep = useMemo(
    () => (activeTour ? (activeTour.steps[state.tourStepIndex] ?? null) : null),
    [activeTour, state.tourStepIndex],
  );

  return {
    state,
    segment: userSegment,

    // Content
    tours,
    features,
    featuresByCategory,
    explorationProgress,

    // Tour state
    activeTour,
    currentStep,

    // Actions
    markSectionVisited,
    startTour,
    advanceTourStep,
    completeTour,
    cancelTour,
    markFeatureExplored,
    markHubOpened,
    markMilestoneCelebrated,
  };
}

/** Lightweight hook for just checking if a section tour should be offered */
export function useSectionDiscovery(section: string) {
  const { segment } = useSegment();
  const [offered, setOffered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isFirst = _markSectionVisited(section);
    if (isFirst) setOffered(true);
  }, [section]);

  const userSegment = (segment ?? 'anonymous') as UserSegment;
  const sectionTours = useMemo(
    () => getSectionTours(section as SectionId, userSegment),
    [section, userSegment],
  );

  return {
    /** True if this is the first visit AND there's a tour available AND not dismissed */
    shouldOfferTour: offered && !dismissed && sectionTours.length > 0,
    /** The tour to offer (first match) */
    tour: sectionTours[0] ?? null,
    /** Dismiss the tour offer */
    dismiss: useCallback(() => setDismissed(true), []),
  };
}
