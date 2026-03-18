'use client';

/**
 * DiscoveryHub — Orchestrator component.
 *
 * Mounts the floating FAB and manages the Sheet panel state.
 * Lazy-loaded in GovernadaShell for zero impact on initial page load.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useDiscovery } from '@/hooks/useDiscovery';
import { posthog } from '@/lib/posthog';
import { DiscoveryFab } from './DiscoveryFab';
import { DiscoveryHubContext } from './DiscoveryHubContext';
import { DiscoveryPanel } from './DiscoveryPanel';

export function DiscoveryHub({ hideFab = false }: { hideFab?: boolean }) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const router = useRouter();
  const { explorationProgress, markHubOpened, startTour, segment } = useDiscovery();

  const handleOpen = useCallback(() => {
    setOpen(true);
    setOpenedAt(Date.now());
    markHubOpened();
    posthog.capture('discovery_hub_opened', {
      segment,
      exploration_percent: explorationProgress.percent,
    });
  }, [markHubOpened, segment, explorationProgress.percent]);

  const handleClose = useCallback(() => {
    setOpen(false);
    if (openedAt) {
      posthog.capture('discovery_hub_closed', {
        segment,
        time_open_ms: Date.now() - openedAt,
      });
    }
    setOpenedAt(null);
  }, [openedAt, segment]);

  const handleStartTour = useCallback(
    (tourId: string, startRoute: string) => {
      handleClose();
      startTour(tourId);
      router.push(startRoute);
    },
    [handleClose, startTour, router],
  );

  return (
    <DiscoveryHubContext.Provider value={{ openHub: handleOpen }}>
      {!hideFab && <DiscoveryFab onClick={handleOpen} progress={explorationProgress.percent} />}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" showCloseButton className="w-[340px] sm:w-[380px] p-0">
          <DiscoveryPanel onStartTour={handleStartTour} onClose={handleClose} />
        </SheetContent>
      </Sheet>
    </DiscoveryHubContext.Provider>
  );
}
