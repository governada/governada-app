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
import { createSpatialMatchBehavior } from '@/lib/globe/behaviors/spatialMatchBehavior';
import { createFocusControlBehavior } from '@/lib/globe/behaviors/focusControlBehavior';
import { createConsideringBehavior } from '@/lib/globe/behaviors/consideringBehavior';

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

  // Command queue: buffer commands arriving before the globe ref is ready (dynamic import timing)
  const commandQueueRef = useRef<GlobeCommand[]>([]);

  // Register behaviors — re-registers with fresh closures on remount (React StrictMode safe)
  useEffect(() => {
    const getGlobe = () => globeRef.current;
    registerBehavior(createMatchBehavior(getGlobe));
    registerBehavior(createVoteSplitBehavior());
    registerBehavior(createTopicWarmBehavior());
    registerBehavior(createClusterBehavior());
    registerBehavior(createDiscoveryBehavior());
    registerBehavior(createSpatialMatchBehavior());
    registerBehavior(createFocusControlBehavior(getGlobe));
    registerBehavior(createConsideringBehavior());
    return () => {
      unregisterBehavior('match');
      unregisterBehavior('voteSplit');
      unregisterBehavior('topicWarm');
      unregisterBehavior('cluster');
      unregisterBehavior('discovery');
      unregisterBehavior('spatialMatch');
      unregisterBehavior('focusControl');
      unregisterBehavior('considering');
    };
  }, [globeRef]);

  // Flush queued commands once the globe ref populates
  useEffect(() => {
    const interval = setInterval(() => {
      if (globeRef.current && commandQueueRef.current.length > 0) {
        const queued = commandQueueRef.current.splice(0);
        for (const cmd of queued) {
          executeGlobeCommand(cmd);
        }
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (!globe) {
        // Buffer commands until globe mounts (dynamic import timing)
        commandQueueRef.current.push(command);
        return;
      }

      // Try registered behaviors first — if one handles the command, skip the switch
      const behaviorCtx: BehaviorContext = {
        dispatch: (cmd) => executeGlobeCommand(cmd),
        schedule: (cmd, delayMs) => {
          const t = setTimeout(() => executeGlobeCommand(cmd), delayMs);
          return () => clearTimeout(t);
        },
      };
      const handled = executeBehavior(command, behaviorCtx);
      if (handled) return;

      // Remaining imperative commands that don't produce FocusIntents
      switch (command.type) {
        case 'flyTo':
          globe.flyToNode(command.nodeId);
          break;
        case 'pulse':
          if (command.nodeId) {
            globe.pulseNode(command.nodeId);
          }
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
      }
    },
    [globeRef],
  );

  return { handleNodeClick, executeGlobeCommand };
}
