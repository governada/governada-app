/**
 * Cluster behavior — highlights a governance faction on the globe.
 *
 * Handles: highlightCluster
 *
 * Produces a FocusIntent with 'from-alignment' using the cluster's centroid,
 * with camera proximity set to 'cluster' for appropriate zoom level.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand } from '@/lib/globe/types';
import { setSharedIntent } from '@/lib/globe/focusIntent';

/** Module-level cluster data cache — populated by ClusterLabels or API fetch */
let clusterCache: Map<string, { memberIds: string[]; centroid6D: number[] }> = new Map();

/** Update the cluster cache (called when cluster data is fetched) */
export function setClusterCache(
  clusters: Array<{ id: string; memberIds: string[]; centroid6D: number[] }>,
): void {
  clusterCache = new Map(
    clusters.map((c) => [c.id, { memberIds: c.memberIds, centroid6D: c.centroid6D }]),
  );
}

export function createClusterBehavior(): GlobeBehavior {
  return {
    id: 'cluster',
    handles: ['highlightCluster'],
    execute(command: GlobeCommand, _ctx: BehaviorContext) {
      if (command.type !== 'highlightCluster') return;

      const cluster = clusterCache.get(command.clusterId);
      if (!cluster) return;

      setSharedIntent({
        focusedIds: 'from-alignment',
        alignmentVector: cluster.centroid6D,
        topN: 150,
        nodeTypeFilter: 'drep',
        cameraProximity: 'cluster',
        atmosphereWarmColor: '#4488cc',
        atmosphereTemperature: 0.4,
      });
    },
    cleanup() {
      // Nothing to clean up — clear is dispatched externally
    },
  };
}
