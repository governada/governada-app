/**
 * Considering behavior — sustained breathing pulse on nodes Seneca is evaluating.
 *
 * While tool execution runs, affected node IDs are dispatched as a 'considering'
 * command. This behavior writes pulsingNodeIds to the FocusIntent so the engine
 * propagates it to FocusState, and NodePoints shows them gently breathing.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand } from '@/lib/globe/types';
import { setSharedIntent } from '@/lib/globe/focusIntent';
import { getSharedIntent } from '@/lib/globe/focusIntent';

export function createConsideringBehavior(): GlobeBehavior {
  return {
    id: 'considering',
    handles: ['considering'],

    execute(command: GlobeCommand, _ctx: BehaviorContext) {
      if (command.type !== 'considering') return;

      const current = getSharedIntent();
      setSharedIntent({
        ...current,
        pulsingNodeIds: new Set(command.nodeIds),
        pulseFrequency: 1.5,
      });
    },

    cleanup() {
      const current = getSharedIntent();
      if (current.pulsingNodeIds) {
        setSharedIntent({
          ...current,
          pulsingNodeIds: undefined,
        });
      }
    },
  };
}
