/**
 * Discovery behavior — handles spatial discovery commands from Seneca advisor tools.
 *
 * Handles: showNeighborhood, showControversy, showActiveEntities
 *
 * Uses `narrowTo` (Chunk 1) for focused highlighting and delegates to
 * `voteSplit` for controversy visualization.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand, ConstellationRef } from '@/lib/globe/types';

export function createDiscoveryBehavior(globeRef: () => ConstellationRef | null): GlobeBehavior {
  return {
    id: 'discovery',
    handles: ['showNeighborhood', 'showControversy', 'showActiveEntities'],
    execute(command: GlobeCommand, ctx: BehaviorContext) {
      const globe = globeRef();
      if (!globe) return;

      switch (command.type) {
        case 'showNeighborhood': {
          // Use narrowTo to focus on entity + neighbors, then pulse the target
          const entityNodeId =
            command.entityType === 'drep'
              ? `drep_${command.entityId}`
              : command.entityType === 'proposal'
                ? `proposal_${command.entityId}`
                : command.entityId;

          // narrowTo handles dim + fly to centroid
          ctx.dispatch({
            type: 'narrowTo',
            nodeIds: [entityNodeId], // Will be enriched by tool — neighborIds in the result
            fly: true,
          });

          // Pulse the target after camera settles
          ctx.schedule({ type: 'pulse', nodeId: entityNodeId }, 400);
          break;
        }

        case 'showControversy': {
          // Delegate to voteSplit behavior — it handles fetching and coloring
          ctx.dispatch({
            type: 'voteSplit',
            proposalRef: command.proposalId,
          });
          break;
        }

        case 'showActiveEntities': {
          // Focus on the active entity nodes
          const nodeIds = command.entityIds.map((id) => {
            if (command.entityType === 'drep') return `drep_${id}`;
            if (command.entityType === 'proposal') return `proposal_${id}`;
            return id;
          });

          if (nodeIds.length === 0) return;

          // narrowTo dims others and flies to their centroid
          ctx.dispatch({
            type: 'narrowTo',
            nodeIds,
            fly: true,
            scanProgress: 0.8,
          });

          // Staggered pulses for visual emphasis
          nodeIds.slice(0, 5).forEach((nodeId, i) => {
            ctx.schedule({ type: 'pulse', nodeId }, 300 + i * 150);
          });
          break;
        }
      }
    },
  };
}
