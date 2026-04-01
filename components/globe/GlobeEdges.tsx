/**
 * GlobeEdges — Intra-cluster constellation lines.
 *
 * Draws thin connecting lines between tightly aligned nodes within each
 * governance cluster, creating Orion-like constellation patterns. Uses
 * minimum spanning tree (MST) for clean, non-tangled visual structure.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { getSharedFocus, getSharedFocusVersion } from '@/lib/globe/focusState';

interface ClusterData {
  memberIds: string[];
}

/**
 * Compute minimum spanning tree edges using Prim's algorithm.
 * Returns pairs of position arrays for lineSegments rendering.
 */
function computeMST(
  nodes: ConstellationNode3D[],
): Array<{ from: [number, number, number]; to: [number, number, number] }> {
  if (nodes.length < 2) return [];

  const n = nodes.length;
  const inTree = new Uint8Array(n);
  const minDist = new Float64Array(n).fill(Infinity);
  const minFrom = new Int32Array(n).fill(-1);
  const edges: Array<{ from: [number, number, number]; to: [number, number, number] }> = [];

  // Start from first node
  inTree[0] = 1;
  for (let j = 1; j < n; j++) {
    minDist[j] = dist3D(nodes[0].position, nodes[j].position);
    minFrom[j] = 0;
  }

  for (let added = 1; added < n; added++) {
    // Find closest node not yet in tree
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!inTree[j] && minDist[j] < bestDist) {
        bestDist = minDist[j];
        best = j;
      }
    }
    if (best < 0) break;

    inTree[best] = 1;
    edges.push({ from: nodes[minFrom[best]].position, to: nodes[best].position });

    // Update distances
    for (let j = 0; j < n; j++) {
      if (inTree[j]) continue;
      const d = dist3D(nodes[best].position, nodes[j].position);
      if (d < minDist[j]) {
        minDist[j] = d;
        minFrom[j] = best;
      }
    }
  }

  return edges;
}

function dist3D(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * ConstellationLines — MST-based lines within each governance cluster.
 * Creates the iconic "constellation pattern" look.
 */
export function ConstellationLines({
  nodes,
  clusters,
}: {
  nodes: ConstellationNode3D[];
  clusters: ClusterData[];
}) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const focusVersionRef = useRef(0);

  // Compute MST edges for all clusters
  const geometry = useMemo(() => {
    if (!clusters.length || !nodes.length) return null;

    const nodeMap = new Map<string, ConstellationNode3D>();
    for (const n of nodes) nodeMap.set(n.id, n);

    const positions: number[] = [];

    for (const cluster of clusters) {
      // Resolve cluster member nodes
      const clusterNodes = cluster.memberIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is ConstellationNode3D => n != null);

      if (clusterNodes.length < 2) continue;

      // Compute MST for this cluster
      const mstEdges = computeMST(clusterNodes);
      for (const edge of mstEdges) {
        positions.push(...edge.from, ...edge.to);
      }
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [nodes, clusters]);

  // Read focus state per frame for opacity dimming
  useFrame(() => {
    if (!matRef.current) return;
    const version = getSharedFocusVersion();
    if (version !== focusVersionRef.current) {
      focusVersionRef.current = version;
      const focus = getSharedFocus();
      matRef.current.opacity = focus.active ? 0.01 : 0.07;
    }
  });

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={matRef}
        color="#2dd4bf"
        transparent
        opacity={0.07}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}
