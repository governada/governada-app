'use client';

/**
 * useSenecaGlobeBridge — Bridges globe node interactions with the Seneca panel.
 *
 * Handles two directions:
 * 1. Globe -> Seneca: Node click opens a contextual conversation
 * 2. Seneca -> Globe: Entity references in responses pulse/fly-to nodes
 */

import { useCallback, type RefObject } from 'react';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { useSenecaThread } from '@/hooks/useSenecaThread';
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
  | { type: 'clear' };

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
  const panel = useSenecaThread();

  const handleNodeClick = useCallback(
    (node: ConstellationNode3D) => {
      const typeLabel =
        node.nodeType === 'drep' ? 'DRep' : node.nodeType === 'spo' ? 'SPO' : 'CC member';
      const name = node.name || node.id.slice(0, 12);
      const query = `Tell me about ${typeLabel} ${name}`;

      // Fly to the node on the globe
      globeRef.current?.flyToNode(node.id);

      // Open Seneca with the entity context
      panel.startConversation(query);
    },
    [globeRef, panel],
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
      }
    },
    [globeRef],
  );

  return { handleNodeClick, executeGlobeCommand };
}
