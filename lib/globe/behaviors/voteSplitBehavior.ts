/**
 * Vote split behavior — handles voteSplit globe command.
 *
 * Handles: voteSplit
 *
 * Parses proposal ref, fetches vote data async, then produces a FocusIntent
 * with colorOverrides mapping each voter to Yes/No/Abstain colors.
 */

import type { GlobeBehavior } from './types';
import type { GlobeCommand } from '@/lib/globe/types';
import { fetchVoteSplit } from '@/lib/constellation/fetchVoteSplit';
import { setSharedIntent } from '@/lib/globe/focusIntent';

const VOTE_COLORS = { Yes: '#2dd4bf', No: '#ef4444', Abstain: '#9ca3af' } as const;

export function createVoteSplitBehavior(): GlobeBehavior {
  return {
    id: 'voteSplit',
    handles: ['voteSplit'],
    execute(command: GlobeCommand) {
      if (command.type !== 'voteSplit') return;

      // Parse "txHash_index" format
      const lastUnderscore = command.proposalRef.lastIndexOf('_');
      if (lastUnderscore === -1) return;
      const txHash = command.proposalRef.slice(0, lastUnderscore);
      const index = parseInt(command.proposalRef.slice(lastUnderscore + 1), 10);
      if (!txHash || isNaN(index)) return;

      void fetchVoteSplit(txHash, index).then((map) => {
        if (map.size === 0) return;

        const focusedIds = new Set<string>();
        const intensities = new Map<string, number>();
        const colorOverrides = new Map<string, string>();

        for (const [nodeId, vote] of map) {
          focusedIds.add(nodeId);
          intensities.set(nodeId, 1.0);
          colorOverrides.set(nodeId, VOTE_COLORS[vote]);
        }

        setSharedIntent({
          focusedIds,
          intensities,
          colorOverrides,
          flyToFocus: true,
          cameraProximity: focusedIds.size > 100 ? 'overview' : 'cluster',
          atmosphereWarmColor: '#cc6644',
          atmosphereTemperature: 0.4,
        });
      });
    },
  };
}
