'use client';

/**
 * useSenecaGlobeBridge — Bridges globe node interactions with the Seneca panel.
 *
 * Handles two directions:
 * 1. Globe -> Seneca: Node click opens a contextual conversation
 * 2. Seneca -> Globe: Entity references in responses pulse/fly-to nodes
 */

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ConstellationRef, GlobeCommand } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { createChoreographer, type Choreography } from '@/lib/globe/choreographer';
import {
  registerBehavior,
  unregisterBehavior,
  executeBehavior,
} from '@/lib/globe/behaviors/registry';
import type { BehaviorContext } from '@/lib/globe/behaviors/types';
import { createMatchBehavior } from '@/lib/globe/behaviors/matchBehavior';
import { createVoteSplitBehavior } from '@/lib/globe/behaviors/voteSplitBehavior';
import { createTopicWarmBehavior } from '@/lib/globe/behaviors/topicWarmBehavior';
import { createClusterBehavior } from '@/lib/globe/behaviors/clusterBehavior';
import { createDiscoveryBehavior } from '@/lib/globe/behaviors/discoveryBehavior';

// GlobeCommand is now canonically defined in lib/globe/types.ts.
// Re-export for backwards compatibility — existing imports of GlobeCommand from this file still work.
export type { GlobeCommand } from '@/lib/globe/types';

export interface GlobeBridgeResult {
  /** Handle node click from globe — opens Seneca with entity context */
  handleNodeClick: (node: ConstellationNode3D) => void;
  /** Execute a globe command from Seneca responses */
  executeGlobeCommand: (command: GlobeCommand) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSenecaGlobeBridge(
  globeRef: RefObject<ConstellationRef | null>,
): GlobeBridgeResult {
  // Lazy-initialized choreographer for cancellable sequence execution
  const choreographerRef = useRef<ReturnType<typeof createChoreographer> | null>(null);

  // Register behaviors — re-registers with fresh closures on remount (React StrictMode safe)
  useEffect(() => {
    const getGlobe = () => globeRef.current;
    registerBehavior(createMatchBehavior(getGlobe));
    registerBehavior(createVoteSplitBehavior(getGlobe));
    registerBehavior(createTopicWarmBehavior(getGlobe));
    registerBehavior(createClusterBehavior(getGlobe));
    registerBehavior(createDiscoveryBehavior(getGlobe));
    return () => {
      unregisterBehavior('match');
      unregisterBehavior('voteSplit');
      unregisterBehavior('topicWarm');
      unregisterBehavior('cluster');
      unregisterBehavior('discovery');
    };
  }, [globeRef]);

  const handleNodeClick = useCallback(
    (node: ConstellationNode3D) => {
      // Fly to the node on the globe — panel opens via URL navigation in GlobeLayout
      globeRef.current?.flyToNode(node.id);
    },
    [globeRef],
  );

  const executeGlobeCommand = useCallback(
    (command: GlobeCommand) => {
      const globe = globeRef.current;
      if (!globe) return;

      // Try registered behaviors first — if one handles the command, skip the switch
      const behaviorCtx: BehaviorContext = {
        dispatch: (cmd) => executeGlobeCommand(cmd),
        schedule: (cmd, delayMs) => {
          const t = setTimeout(() => executeGlobeCommand(cmd), delayMs);
          return () => clearTimeout(t);
        },
      };
      if (executeBehavior(command, behaviorCtx)) return;

      switch (command.type) {
        case 'flyTo':
          globe.flyToNode(command.nodeId);
          break;
        case 'pulse':
          globe.pulseNode(command.nodeId);
          break;
        case 'highlight':
          globe.highlightMatches(command.alignment, command.threshold, {
            noZoom: command.noZoom,
            zoomToCluster: command.zoomToCluster,
            nodeTypeFilter: command.nodeTypeFilter,
            cameraAngle: command.cameraAngle,
            cameraElevation: command.cameraElevation,
            drepOnly: command.drepOnly,
            topN: command.topN,
            scanProgressOverride: command.scanProgressOverride,
          });
          break;
        // voteSplit handled by voteSplitBehavior
        case 'reset':
          globe.resetCamera();
          break;
        case 'clear':
          globe.clearMatches();
          break;

        // --- Match flow commands ---

        // matchStart, matchFlyTo, scan handled by matchBehavior
        // voteSplit handled by voteSplitBehavior
        // warmTopic handled by topicWarmBehavior

        case 'dim':
          globe.dimAll();
          break;

        case 'sequence': {
          // Execute commands via choreographer — cancellable, inspectable
          const choreography: Choreography = {
            name: 'sequence',
            steps: command.steps.map((s) => ({
              command: s.command,
              delayMs: s.delayMs,
            })),
          };
          if (!choreographerRef.current) {
            choreographerRef.current = createChoreographer((cmd) => {
              if (cmd.type !== 'sequence') executeGlobeCommand(cmd);
            });
          }
          choreographerRef.current.play(choreography);
          break;
        }

        // --- Theatrical match choreography commands ---

        case 'setRotation':
          globe.setRotationSpeed(command.speed);
          break;

        case 'zoomOut':
          globe.zoomToDistance(command.distance ?? 20);
          break;

        case 'flash':
          globe.flashNode(command.nodeId);
          break;

        case 'cinematic':
          globe.setCinematicState(command.state);
          break;

        case 'flyToPosition':
          globe.flyToPosition(command.target, {
            distance: command.distance,
            duration: command.duration,
          });
          break;

        case 'narrowTo':
          globe.narrowTo(command.nodeIds, {
            cameraAngle: command.cameraAngle,
            cameraElevation: command.cameraElevation,
            scanProgress: command.scanProgress,
            fly: command.fly,
          });
          break;
      }
    },
    [globeRef],
  );

  return { handleNodeClick, executeGlobeCommand };
}
