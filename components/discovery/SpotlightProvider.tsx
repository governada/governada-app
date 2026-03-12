'use client';

/**
 * SpotlightProvider — Context provider for the spotlight tour system.
 *
 * Manages active tour state, renders SpotlightOverlay when a tour is
 * in progress, and provides methods to start/advance/skip tours.
 *
 * Route-aware: navigates between pages for multi-page tours and waits
 * for the DOM to settle before rendering the spotlight overlay.
 */

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDiscovery } from '@/hooks/useDiscovery';
import { emitDiscoveryEvent } from '@/lib/discovery/events';
import { posthog } from '@/lib/posthog';
import { SpotlightOverlay } from './SpotlightOverlay';

interface SpotlightContextValue {
  activeTourId: string | null;
  startTour: (tourId: string) => void;
}

const SpotlightContext = createContext<SpotlightContextValue>({
  activeTourId: null,
  startTour: () => {},
});

export function useSpotlight() {
  return useContext(SpotlightContext);
}

export function SpotlightProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const {
    state,
    activeTour,
    currentStep,
    startTour: _startTour,
    advanceTourStep,
    completeTour,
    cancelTour,
    markFeatureExplored,
  } = useDiscovery();

  // Navigate to the current step's route if it differs from the current pathname
  useEffect(() => {
    if (!activeTour || !currentStep?.route) return;
    if (currentStep.route !== pathname) {
      setIsNavigating(true);
      router.push(currentStep.route);
    }
  }, [activeTour, currentStep, pathname, router]);

  // Clear navigating flag once we arrive at the correct route
  useEffect(() => {
    if (isNavigating && currentStep?.route === pathname) {
      // Small delay for the new page's DOM to render
      const timer = setTimeout(() => setIsNavigating(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isNavigating, currentStep?.route, pathname]);

  const handleStartTour = useCallback(
    (tourId: string) => {
      _startTour(tourId);
    },
    [_startTour],
  );

  const handleNext = useCallback(() => {
    if (!activeTour) return;

    const nextIndex = state.tourStepIndex + 1;
    if (nextIndex >= activeTour.steps.length) {
      // Tour complete — mark related features as explored
      if (activeTour.relatedFeatures) {
        for (const featureId of activeTour.relatedFeatures) {
          markFeatureExplored(featureId);
        }
      }
      completeTour();
      emitDiscoveryEvent('tour_completed', { tour_id: activeTour.id });
      posthog.capture('discovery_tour_completed', {
        tour_id: activeTour.id,
        steps_viewed: activeTour.steps.length,
      });
    } else {
      // Check if next step requires navigation
      const nextStep = activeTour.steps[nextIndex];
      if (nextStep?.route && nextStep.route !== pathname) {
        setIsNavigating(true);
      }
      advanceTourStep();
      posthog.capture('discovery_tour_step_viewed', {
        tour_id: activeTour.id,
        step_index: nextIndex,
        step_id: nextStep?.id,
      });
    }
  }, [
    activeTour,
    state.tourStepIndex,
    advanceTourStep,
    completeTour,
    markFeatureExplored,
    pathname,
  ]);

  const handleSkip = useCallback(() => {
    if (activeTour) {
      posthog.capture('discovery_tour_skipped', {
        tour_id: activeTour.id,
        step_index: state.tourStepIndex,
      });
    }
    cancelTour();
  }, [activeTour, state.tourStepIndex, cancelTour]);

  const contextValue = useMemo(
    () => ({
      activeTourId: state.tourInProgress,
      startTour: handleStartTour,
    }),
    [state.tourInProgress, handleStartTour],
  );

  // Only show overlay when on the correct route and not mid-navigation
  const shouldShowOverlay =
    activeTour &&
    currentStep &&
    !isNavigating &&
    (!currentStep.route || currentStep.route === pathname);

  return (
    <SpotlightContext.Provider value={contextValue}>
      {children}
      {shouldShowOverlay && (
        <SpotlightOverlay
          step={currentStep}
          stepIndex={state.tourStepIndex}
          totalSteps={activeTour.steps.length}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      )}
    </SpotlightContext.Provider>
  );
}
