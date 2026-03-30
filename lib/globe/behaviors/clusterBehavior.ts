/**
 * Cluster behavior — highlights a governance faction on the globe.
 *
 * Handles: highlightCluster
 *
 * When activated, dims all non-member nodes and highlights cluster members
 * using the cluster's centroid alignment as the highlight target.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand, ConstellationRef } from '@/lib/globe/types';

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

export function createClusterBehavior(globeRef: () => ConstellationRef | null): GlobeBehavior {
  return {
    id: 'cluster',
    handles: ['highlightCluster'],
    execute(command: GlobeCommand, _ctx: BehaviorContext) {
      if (command.type !== 'highlightCluster') return;
      const globe = globeRef();
      if (!globe) return;

      const cluster = clusterCache.get(command.clusterId);
      if (!cluster) return;

      // Dim everything first
      globe.dimAll();

      // Then highlight cluster members using centroid alignment
      // Use a narrow threshold to focus on just the cluster
      globe.highlightMatches(cluster.centroid6D, 150, {
        noZoom: false,
        zoomToCluster: true,
        drepOnly: true,
      });
    },
    cleanup() {
      // Nothing to clean up — clear is dispatched externally
    },
  };
}
