'use client';

/**
 * SpotlightProvider — Context provider for the spotlight tour system.
 *
 * Manages active tour state, renders SpotlightOverlay when a tour is
 * in progress, and provides methods to start/advance/skip tours.
 */

import { createContext, useContext, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useDiscovery } from '@/hooks/useDiscovery';
import { getTourById } from '@/lib/discovery/content';
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
  const {
    state,
    activeTour,
    currentStep,
    startTour: _startTour,
    advanceTourStep,
    completeTour,
    cancelTour,
  } = useDiscovery();

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
      // Tour complete
      completeTour();
      emitDiscoveryEvent('tour_completed', { tour_id: activeTour.id });
      posthog.capture('discovery_tour_completed', {
        tour_id: activeTour.id,
        steps_viewed: activeTour.steps.length,
      });
    } else {
      advanceTourStep();
      posthog.capture('discovery_tour_step_viewed', {
        tour_id: activeTour.id,
        step_index: nextIndex,
        step_id: activeTour.steps[nextIndex]?.id,
      });
    }
  }, [activeTour, state.tourStepIndex, advanceTourStep, completeTour]);

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

  return (
    <SpotlightContext.Provider value={contextValue}>
      {children}
      {activeTour && currentStep && (
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
