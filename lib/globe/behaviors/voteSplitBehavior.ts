/**
 * Vote split behavior — handles voteSplit globe command.
 *
 * Parses proposal ref, fetches vote data async, applies to globe.
 */

import type { GlobeBehavior } from './types';
import type { GlobeCommand, ConstellationRef } from '@/lib/globe/types';
import { fetchVoteSplit } from '@/lib/constellation/fetchVoteSplit';

export function createVoteSplitBehavior(globeRef: () => ConstellationRef | null): GlobeBehavior {
  return {
    id: 'voteSplit',
    handles: ['voteSplit'],
    execute(command: GlobeCommand) {
      if (command.type !== 'voteSplit') return;
      const globe = globeRef();
      if (!globe) return;

      // Parse "txHash_index" format
      const lastUnderscore = command.proposalRef.lastIndexOf('_');
      if (lastUnderscore === -1) return;
      const txHash = command.proposalRef.slice(0, lastUnderscore);
      const index = parseInt(command.proposalRef.slice(lastUnderscore + 1), 10);
      if (!txHash || isNaN(index)) return;

      void fetchVoteSplit(txHash, index).then((map) => {
        if (map.size > 0) globe.setVoteSplit(map);
      });
    },
  };
}
