/**
 * Match behavior — handles match-flow globe commands.
 *
 * Handles: matchStart, matchFlyTo, scan
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand, ConstellationRef } from '@/lib/globe/types';

export function createMatchBehavior(globeRef: () => ConstellationRef | null): GlobeBehavior {
  return {
    id: 'match',
    handles: ['matchStart', 'matchFlyTo', 'scan'],
    execute(command: GlobeCommand, ctx: BehaviorContext) {
      const globe = globeRef();
      if (!globe) return;

      switch (command.type) {
        case 'matchStart':
          globe.matchStart();
          break;
        case 'matchFlyTo':
          globe.flyToMatch(command.nodeId);
          break;
        case 'scan': {
          const scanAlignment = command.alignment;
          // Phase 1: wide glow
          globe.highlightMatches(scanAlignment, 300, { noZoom: true });
          // Phase 2: narrow after delay
          const dur = command.durationMs ?? 800;
          ctx.schedule(
            {
              type: 'highlight',
              alignment: scanAlignment,
              threshold: 120,
              noZoom: true,
              zoomToCluster: true,
            },
            dur,
          );
          break;
        }
      }
    },
  };
}
