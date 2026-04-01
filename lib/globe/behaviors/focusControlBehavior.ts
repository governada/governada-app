/**
 * Focus control behavior — handles commands that produce FocusIntents.
 *
 * Handles: highlight, dim, narrowTo, clear, reset
 *
 * These commands were previously handled by the bridge switch statement
 * calling imperative ref methods. Now they produce declarative intents
 * that the reactive focus engine derives into FocusState + camera.
 *
 * The 'reset' command still needs the globeRef for camera reset (imperative),
 * but the focus state is managed reactively.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand, ConstellationRef } from '@/lib/globe/types';
import { DEFAULT_INTENT } from '@/lib/globe/types';
import { setSharedIntent } from '@/lib/globe/focusIntent';

export function createFocusControlBehavior(globeRef: () => ConstellationRef | null): GlobeBehavior {
  return {
    id: 'focusControl',
    handles: ['highlight', 'dim', 'narrowTo', 'clear', 'reset'],
    execute(command: GlobeCommand, _ctx: BehaviorContext) {
      switch (command.type) {
        case 'highlight': {
          setSharedIntent({
            focusedIds: 'from-alignment',
            alignmentVector: command.alignment,
            topN: command.topN,
            nodeTypeFilter: command.nodeTypeFilter ?? (command.drepOnly ? 'drep' : null),
            flyToFocus: !command.noZoom,
            cameraProximity: command.zoomToCluster ? 'cluster' : undefined,
            approachAngle: command.cameraAngle,
            scanProgress: command.scanProgressOverride,
          });
          break;
        }

        case 'dim': {
          setSharedIntent({
            focusedIds: new Set<string>(),
            forceActive: true,
            dimStrength: 0.8,
          });
          break;
        }

        case 'narrowTo': {
          setSharedIntent({
            focusedIds: new Set(command.nodeIds),
            flyToFocus: command.fly ?? true,
            scanProgress: command.scanProgress,
            approachAngle: command.cameraAngle,
            cameraProximity: command.nodeIds.length <= 4 ? 'tight' : 'cluster',
          });
          break;
        }

        case 'clear': {
          setSharedIntent(DEFAULT_INTENT);
          break;
        }

        case 'reset': {
          setSharedIntent(DEFAULT_INTENT);
          // Camera reset is imperative — the engine doesn't control the reset position
          const globe = globeRef();
          if (globe) globe.resetCamera();
          break;
        }
      }
    },
  };
}
