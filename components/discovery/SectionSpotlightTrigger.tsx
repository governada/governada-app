'use client';

/**
 * SectionSpotlightTrigger — First-visit tour prompt for sections.
 *
 * Added to section layouts. On first visit, shows a small floating
 * prompt asking if the user wants a guided tour of that section.
 * Auto-dismisses after 5 seconds.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Compass, X } from 'lucide-react';
import { spring } from '@/lib/animations';
import { useSpotlight } from './SpotlightProvider';
import { useSectionDiscovery } from '@/hooks/useDiscovery';
import { posthog } from '@/lib/posthog';

interface SectionSpotlightTriggerProps {
  section: string;
}

export function SectionSpotlightTrigger({ section }: SectionSpotlightTriggerProps) {
  const { shouldOfferTour, tour, dismiss } = useSectionDiscovery(section);
  const { startTour, activeTourId } = useSpotlight();
  const shouldReduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  // Show prompt after a brief delay (let the page render first)
  useEffect(() => {
    if (!shouldOfferTour || activeTourId) return;
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [shouldOfferTour, activeTourId]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      dismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  const handleAccept = useCallback(() => {
    if (!tour) return;
    setVisible(false);
    dismiss();
    startTour(tour.id);
    posthog.capture('discovery_tour_started', {
      tour_id: tour.id,
      source: 'first_visit',
    });
  }, [tour, dismiss, startTour]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    dismiss();
  }, [dismiss]);

  return (
    <AnimatePresence>
      {visible && tour && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.smooth}
          className="mx-4 mb-3 rounded-lg border border-primary/20 bg-primary/5 backdrop-blur-sm px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Compass className="h-4 w-4 text-primary shrink-0" />
            <p className="flex-1 text-sm text-muted-foreground">
              First time here?{' '}
              <button onClick={handleAccept} className="text-primary font-medium hover:underline">
                Take a quick tour
              </button>
            </p>
            <button
              onClick={handleDismiss}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
