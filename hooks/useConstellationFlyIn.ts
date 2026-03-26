'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
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

      try {
        await globe.flyToNode(userNode.id);
      } catch {
        // flyToNode may not find the user node by ID if it was just injected
        // Fall back gracefully
      }

      setState('settled');

      // Transition to idle after a pause for briefing to start
      setTimeout(() => setState('idle'), 1500);
    }, 600); // brief pause before flying to build anticipation

    return () => clearTimeout(timer);
  }, [globeReady, userNode, globeRef]);

  return {
    flyInState: state,
    onGlobeReady,
    isSettled: state === 'settled' || state === 'idle',
  };
}
