'use client';

/**
 * ClusterLabels — floating faction name labels on the globe.
 *
 * Renders as a CSS overlay in GlobeLayout, positioned by mapping cluster
 * centroid sphere coordinates (lon, lat) to viewport positions via a simple
 * equirectangular projection. Labels fade at close zoom and are gated behind
 * the `globe_alignment_layout` feature flag.
 *
 * This component does NOT modify the rendering layer — it sits as a sibling
 * overlay on top of the Canvas in GlobeLayout's z-stack.
 */

import { useEffect, useState, useCallback } from 'react';
import { useFeatureFlag } from '@/components/FeatureGate';
import { setClusterCache } from '@/lib/globe/behaviors/clusterBehavior';
import { cn } from '@/lib/utils';

interface ClusterData {
  id: string;
  name: string;
  description: string;
  centroidSphere: [number, number]; // [lon, lat]
  centroid3D: [number, number, number];
  memberCount: number;
  dominantDimension: string;
  memberIds: string[];
}

interface ClustersResponse {
  clusters: ClusterData[];
  silhouetteScore: number;
  k: number;
}

/**
 * Map sphere coordinates to viewport percentages.
 * Uses equirectangular projection: lon → x%, lat → y%.
 * The globe's default camera looks at the front face (lon ~0),
 * so lon=0 maps to center-x and lat=0 maps to center-y.
 */
function sphereToViewport(lon: number, lat: number): { x: number; y: number; visible: boolean } {
  // Normalize longitude to [-PI, PI] → [0%, 100%]
  // Camera faces lon=0, so center of viewport = lon=0
  const xNorm = ((lon + Math.PI) / (2 * Math.PI)) * 100;

  // Latitude: +PI/2 = top, -PI/2 = bottom
  // Map to viewport: top=0%, bottom=100%, equator=50%
  const yNorm = (1 - (lat + Math.PI / 2) / Math.PI) * 100;

  // Consider visible if roughly in the front hemisphere
  // (lon between -PI/2 and PI/2 on initial camera)
  const visible = Math.abs(lon) < Math.PI / 2 + 0.3;

  return {
    x: Math.max(10, Math.min(90, xNorm)),
    y: Math.max(15, Math.min(85, yNorm)),
    visible,
  };
}

export function ClusterLabels() {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const flagEnabled = useFeatureFlag('globe_alignment_layout');

  const fetchClusters = useCallback(async () => {
    try {
      const res = await fetch('/api/governance/constellation/clusters');
      if (!res.ok) return;
      const data: ClustersResponse = await res.json();
      setClusters(data.clusters);

      // Populate the behavior cache so highlightCluster commands work
      setClusterCache(
        data.clusters.map((c) => ({
          id: c.id,
          memberIds: c.memberIds,
          centroid6D: [], // Not needed for the behavior
        })),
      );
    } catch {
      // Silent failure — labels are decorative
    }
  }, []);

  useEffect(() => {
    if (flagEnabled) {
      fetchClusters();
    }
  }, [flagEnabled, fetchClusters]);

  if (!flagEnabled || clusters.length === 0) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none" aria-hidden="true">
      {clusters.map((cluster) => {
        const [lon, lat] = cluster.centroidSphere;
        const { x, y, visible } = sphereToViewport(lon, lat);

        return (
          <div
            key={cluster.id}
            className={cn(
              'absolute font-mono text-xs text-muted-foreground/50',
              'transition-opacity duration-1000',
              visible ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="whitespace-nowrap">{cluster.name}</div>
            <div className="text-[10px] text-muted-foreground/30">{cluster.memberCount} DReps</div>
          </div>
        );
      })}
    </div>
  );
}
