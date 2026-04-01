/**
 * Discovery behavior — handles spatial discovery commands from Seneca advisor tools.
 *
 * Handles: showNeighborhood, showControversy, showActiveEntities
 *
 * Produces FocusIntents for neighborhood and active entity highlighting.
 * Delegates controversy visualization to the voteSplit behavior.
 * Keeps imperative pulse scheduling for emphasis effects.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand } from '@/lib/globe/types';
import { setSharedIntent } from '@/lib/globe/focusIntent';

export function createDiscoveryBehavior(): GlobeBehavior {
  return {
    id: 'discovery',
    handles: ['showNeighborhood', 'showControversy', 'showActiveEntities'],
    execute(command: GlobeCommand, ctx: BehaviorContext) {
      switch (command.type) {
        case 'showNeighborhood': {
          const entityNodeId =
            command.entityType === 'drep'
              ? `drep_${command.entityId}`
              : command.entityType === 'proposal'
                ? `proposal_${command.entityId}`
                : command.entityId;

          setSharedIntent({
            focusedIds: new Set([entityNodeId]),
            cameraProximity: 'tight',
            flyToFocus: true,
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
          const nodeIds = command.entityIds.map((id) => {
            if (command.entityType === 'drep') return `drep_${id}`;
            if (command.entityType === 'proposal') return `proposal_${id}`;
            return id;
          });

          if (nodeIds.length === 0) return;

          setSharedIntent({
            focusedIds: new Set(nodeIds),
            flyToFocus: true,
            scanProgress: 0.8,
            cameraProximity: nodeIds.length <= 4 ? 'tight' : 'cluster',
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
