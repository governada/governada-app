/**
 * Topic warm behavior — subtly highlights governance topic areas.
 *
 * Handles: warmTopic
 *
 * Produces a FocusIntent with 'from-alignment' sentinel — the engine
 * resolves to the topN closest DRep nodes without moving the camera.
 */

import type { GlobeBehavior } from './types';
import type { GlobeCommand } from '@/lib/globe/types';
import { setSharedIntent } from '@/lib/globe/focusIntent';

const TOPIC_ALIGNMENTS: Record<string, number[]> = {
  treasury: [85, 20, 50, 50, 50, 50],
  participation: [50, 80, 50, 50, 50, 50],
  delegation: [50, 50, 80, 50, 50, 50],
  proposals: [50, 50, 50, 80, 50, 50],
};

export function createTopicWarmBehavior(): GlobeBehavior {
  return {
    id: 'topicWarm',
    handles: ['warmTopic'],
    execute(command: GlobeCommand) {
      if (command.type !== 'warmTopic') return;

      const align = TOPIC_ALIGNMENTS[command.topic] ?? [50, 50, 50, 50, 50, 50];
      setSharedIntent({
        focusedIds: 'from-alignment',
        alignmentVector: align,
        topN: 200,
        nodeTypeFilter: 'drep',
        flyToFocus: false,
        dimStrength: 0.3,
        atmosphereWarmColor: '#886644',
        atmosphereTemperature: 0.3,
      });
    },
  };
}
