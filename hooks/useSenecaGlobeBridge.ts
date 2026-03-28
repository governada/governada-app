'use client';

/**
 * useSenecaGlobeBridge — Bridges globe node interactions with the Seneca panel.
 *
 * Handles two directions:
 * 1. Globe -> Seneca: Node click opens a contextual conversation
 * 2. Seneca -> Globe: Entity references in responses pulse/fly-to nodes
 */

import { useCallback, type RefObject } from 'react';
import type { ConstellationRef, CinematicStateInput } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { fetchVoteSplit } from '@/lib/constellation/fetchVoteSplit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GlobeCommand =
  | { type: 'flyTo'; nodeId: string }
  | { type: 'pulse'; nodeId: string }
  | {
      type: 'highlight';
      alignment: number[];
      threshold: number;
      noZoom?: boolean;
      zoomToCluster?: boolean;
    }
  | { type: 'voteSplit'; proposalRef: string }
  | { type: 'reset' }
  | { type: 'clear' }
  /** Dim all nodes — used before progressive reveal during tool execution */
  | { type: 'dim' }
  /** Scanning sweep — highlight with wide threshold then narrow, simulating a search */
  | { type: 'scan'; alignment: number[]; durationMs?: number }
  /** Warm specific nodes by topic — subtle highlight without camera movement */
  | { type: 'warmTopic'; topic: 'treasury' | 'participation' | 'delegation' | 'proposals' }
  /** Sequenced choreography — execute commands in order with delays */
  | { type: 'sequence'; steps: Array<{ command: GlobeCommand; delayMs: number }> }
  /** Set globe rotation speed multiplier (1=default, 0=stop, 3=fast) */
  | { type: 'setRotation'; speed: number }
  /** Dolly camera to a specific distance from origin */
  | { type: 'zoomOut'; distance?: number }
  /** Brief emissive flash on a node (reveal moment) */
  | { type: 'flash'; nodeId: string }
  /** Cinematic state — smooth per-frame camera orbit + node transitions */
  | { type: 'cinematic'; state: CinematicStateInput };

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
          });
          break;
        case 'voteSplit': {
          // Parse "txHash_index" format and fetch vote data async
          const lastUnderscore = command.proposalRef.lastIndexOf('_');
          if (lastUnderscore === -1) break;
          const txHash = command.proposalRef.slice(0, lastUnderscore);
          const index = parseInt(command.proposalRef.slice(lastUnderscore + 1), 10);
          if (!txHash || isNaN(index)) break;
          void fetchVoteSplit(txHash, index).then((map) => {
            if (map.size > 0) globe.setVoteSplit(map);
          });
          break;
        }
        case 'reset':
          globe.resetCamera();
          break;
        case 'clear':
          globe.clearMatches();
          break;

        // --- Advanced choreography commands ---

        case 'dim':
          // Dim all nodes by highlighting nothing (very high threshold = nothing matches)
          globe.highlightMatches([0, 0, 0, 0, 0, 0], 9999, { noZoom: true });
          break;

        case 'scan': {
          // Scanning sweep: start wide, narrow to target
          const scanAlignment = command.alignment;
          // Phase 1: wide glow (everything subtly lit)
          globe.highlightMatches(scanAlignment, 300, { noZoom: true });
          // Phase 2: narrow to matches after delay
          const dur = command.durationMs ?? 800;
          setTimeout(() => {
            globe.highlightMatches(scanAlignment, 120, { noZoom: true, zoomToCluster: true });
          }, dur);
          break;
        }

        case 'warmTopic': {
          // Topic-specific alignment vectors for subtle highlighting
          const topicAlignments: Record<string, number[]> = {
            treasury: [85, 20, 50, 50, 50, 50],
            participation: [50, 80, 50, 50, 50, 50],
            delegation: [50, 50, 80, 50, 50, 50],
            proposals: [50, 50, 50, 80, 50, 50],
          };
          const align = topicAlignments[command.topic] ?? [50, 50, 50, 50, 50, 50];
          globe.highlightMatches(align, 200, { noZoom: true });
          break;
        }

        case 'sequence': {
          // Execute commands in order with delays
          let totalDelay = 0;
          for (const step of command.steps) {
            totalDelay += step.delayMs;
            const cmd = step.command;
            setTimeout(() => {
              // Recursive — but sequences should not nest deeply
              if (cmd.type !== 'sequence') {
                executeGlobeCommand(cmd);
              }
            }, totalDelay);
          }
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
      }
    },
    [globeRef],
  );

  return { handleNodeClick, executeGlobeCommand };
}
