/**
 * Spatial match behavior — places a match-derived user node on the globe.
 *
 * Handles: placeUserNode
 *
 * Merges the userNode field into the current FocusIntent so the engine
 * derives the correct FocusState with the citizen's position in governance space.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand } from '@/lib/globe/types';
import { getSharedIntent, setSharedIntent } from '@/lib/globe/focusIntent';

export function createSpatialMatchBehavior(): GlobeBehavior {
  return {
    id: 'spatialMatch',
    handles: ['placeUserNode'],
    execute(command: GlobeCommand, _ctx: BehaviorContext) {
      if (command.type !== 'placeUserNode') return;

      const current = getSharedIntent();
      setSharedIntent({
        ...current,
        userNode: { position: command.position, intensity: command.intensity },
      });
    },
    cleanup() {
      const current = getSharedIntent();
      setSharedIntent({ ...current, userNode: null });
    },
  };
}
