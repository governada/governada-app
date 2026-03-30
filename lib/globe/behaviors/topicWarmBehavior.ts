/**
 * Topic warm behavior — subtly highlights governance topic areas.
 *
 * Handles: warmTopic
 */

import type { GlobeBehavior } from './types';
import type { GlobeCommand, ConstellationRef } from '@/lib/globe/types';

const TOPIC_ALIGNMENTS: Record<string, number[]> = {
  treasury: [85, 20, 50, 50, 50, 50],
  participation: [50, 80, 50, 50, 50, 50],
  delegation: [50, 50, 80, 50, 50, 50],
  proposals: [50, 50, 50, 80, 50, 50],
};

export function createTopicWarmBehavior(globeRef: () => ConstellationRef | null): GlobeBehavior {
  return {
    id: 'topicWarm',
    handles: ['warmTopic'],
    execute(command: GlobeCommand) {
      if (command.type !== 'warmTopic') return;
      const globe = globeRef();
      if (!globe) return;

      const align = TOPIC_ALIGNMENTS[command.topic] ?? [50, 50, 50, 50, 50, 50];
      globe.highlightMatches(align, 200, { noZoom: true });
    },
  };
}
