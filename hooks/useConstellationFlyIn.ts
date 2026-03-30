'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConstellationRef } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';

type FlyInState = 'waiting' | 'flying' | 'settled' | 'idle';

/**
 * Manages the cinematic camera fly-in animation for the Inhabited Constellation.
 *
 * State machine:
 *   waiting  — globe loading, user node computing
 *   flying   — camera animating from orbit to user position
 *   settled  — camera arrived at user position (briefing can start)
 *   idle     — rotation resumed, fully interactive
 */
export function useConstellationFlyIn(
  globeRef: React.RefObject<ConstellationRef | null>,
  userNode: ConstellationNode3D | null,
) {
  const [state, setState] = useState<FlyInState>('waiting');
  const [globeReady, setGlobeReady] = useState(false);
  const flyInStarted = useRef(false);

  const onGlobeReady = useCallback(() => {
    setGlobeReady(true);
  }, []);

  // Trigger fly-in when both globe and user node are ready
  useEffect(() => {
    if (!globeReady || !userNode || flyInStarted.current) return;
    flyInStarted.current = true;

    setState('flying');

    // Fly to user's node with a cinematic delay
    const timer = setTimeout(async () => {
      const globe = globeRef.current;
      if (!globe) {
        setState('settled');
        return;
      }

      // Try flyToNode first — may fail if node not yet in nodeMap due to timing
      try {
        const found = await globe.flyToNode(userNode.id);
        if (found) {
          setState('settled');
          setTimeout(() => setState('idle'), 1500);
          return;
        }
      } catch {
        // Fall through to manual positioning
      }

      // Fallback: fly to user node's raw position
      // flyToNode returns null when node not found, but we know the position
      try {
        // Pulse the node to make it visible
        globe.pulseNode(userNode.id);
      } catch {
        // Ignore — node may not be in the scene yet
      }

      setState('settled');
      setTimeout(() => setState('idle'), 1500);
    }, 800);

    return () => clearTimeout(timer);
  }, [globeReady, userNode, globeRef]);

  return {
    flyInState: state,
    onGlobeReady,
    isSettled: state === 'settled' || state === 'idle',
  };
}
