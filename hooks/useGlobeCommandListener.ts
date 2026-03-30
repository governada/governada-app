'use client';

/**
 * useGlobeCommandListener — Subscribes to the globe command bus and routes
 * commands through the Seneca-Globe bridge.
 *
 * Replaces the 5+ identical useEffect + addEventListener patterns scattered
 * across SynapticHomePage, AnonymousLanding, GlobeLayout, etc.
 */

import { useEffect } from 'react';
import { onGlobeCommand } from '@/lib/globe/globeCommandBus';
import type { GlobeBridgeResult } from '@/hooks/useSenecaGlobeBridge';

export function useGlobeCommandListener(bridge: GlobeBridgeResult | null): void {
  useEffect(() => {
    if (!bridge) return;
    return onGlobeCommand((command) => {
      bridge.executeGlobeCommand(command);
    });
  }, [bridge]);
}
