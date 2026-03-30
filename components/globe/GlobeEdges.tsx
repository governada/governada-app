/**
 * GlobeEdges — Edge rendering components for the constellation visualization.
 *
 * Includes:
 * - NetworkEdgeLines: API-fetched network edges between entities
 * - EdgeLayer: Single-type edge rendering with focus-aware opacity
 * - ConstellationEdges: Composite edge renderer splitting by type
 * - NeuralMesh: Gossamer neural network threads between nearby nodes
 */

import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { ConstellationEdge3D, ConstellationNode3D } from '@/lib/constellation/types';
import { NETWORK_EDGE_COLORS } from '@/lib/globe/types';

// ---------------------------------------------------------------------------
// NetworkEdgeLines — API-fetched entity network edges
// ---------------------------------------------------------------------------

export function NetworkEdgeLines({
  nodes,
  visible,
}: {
  nodes: ConstellationNode3D[];
  visible: boolean;
}) {
  // Fetch edge data from API
  const { data } = useQuery<{
    edges: Array<{ from: string; to: string; type: string; weight: number }>;
  }>({
    queryKey: ['cockpit-network-edges-scene'],
    queryFn: async () => {
      const res = await fetch('/api/cockpit/network-edges');
      if (!res.ok) return { edges: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: visible,
  });

  const lines = useMemo(() => {
    if (!visible || !data?.edges?.length || nodes.length === 0) return [];

    // Build nodeMap for position lookup
    const nodeMap = new Map<string, ConstellationNode3D>();
    for (const n of nodes) {
      nodeMap.set(n.id, n);
      if (n.fullId) nodeMap.set(n.fullId, n);
    }

    const result: Array<{
      points: [number, number, number][];
      color: string;
      type: string;
    }> = [];

    // Cap at 20 edges for performance
    for (const edge of data.edges.slice(0, 20)) {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) continue;

      // Slightly offset lines above the globe surface to prevent z-fighting
      const lift = 0.15;
      const from = fromNode.position;
      const to = toNode.position;
      const fromLen = Math.sqrt(from[0] ** 2 + from[1] ** 2 + from[2] ** 2) || 1;
      const toLen = Math.sqrt(to[0] ** 2 + to[1] ** 2 + to[2] ** 2) || 1;

      result.push({
        points: [
          [
            from[0] * (1 + lift / fromLen),
            from[1] * (1 + lift / fromLen),
            from[2] * (1 + lift / fromLen),
          ],
          [to[0] * (1 + lift / toLen), to[1] * (1 + lift / toLen), to[2] * (1 + lift / toLen)],
        ],
        color: NETWORK_EDGE_COLORS[edge.type] ?? '#ffffff',
        type: edge.type,
      });
    }

    return result;
  }, [visible, data, nodes]);

  if (!visible || lines.length === 0) return null;

  return (
    <group>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          color={line.color}
          lineWidth={line.type === 'delegation' ? 1.5 : 1}
          transparent
          opacity={0.6}
          dashed={line.type !== 'delegation'}
          dashSize={line.type === 'alignment' ? 0.3 : 0.15}
          gapSize={line.type === 'alignment' ? 0.15 : 0.2}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Edge styles per type
// ---------------------------------------------------------------------------

const EDGE_STYLES = {
  proximity: { color: '#4488aa', opacity: 0.12, dimOpacity: 0.03 },
  infrastructure: { color: '#7c6cc4', opacity: 0.15, dimOpacity: 0.04 },
  lastmile: { color: '#1a3a4a', opacity: 0.06, dimOpacity: 0.015 },
  orbital: { color: '#fbbf24', opacity: 0.3, dimOpacity: 0.08 }, // kept for type compat
} as const;

// ---------------------------------------------------------------------------
// EdgeLayer — Single-type edge rendering
// ---------------------------------------------------------------------------

export function EdgeLayer({
  edges,
  focusActive,
  edgeType,
}: {
  edges: ConstellationEdge3D[];
  focusActive: boolean;
  edgeType: keyof typeof EDGE_STYLES;
}) {
  const geometry = useMemo(() => {
    if (edges.length === 0) return null;
    const positions: number[] = [];
    for (const { from, to } of edges) {
      positions.push(...from, ...to);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [edges]);

  if (!geometry) return null;
  const style = EDGE_STYLES[edgeType];

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color={style.color}
        transparent
        opacity={focusActive ? style.dimOpacity : style.opacity}
        toneMapped={false}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// ---------------------------------------------------------------------------
// ConstellationEdges — Composite edge renderer
// ---------------------------------------------------------------------------

export function ConstellationEdges({
  edges,
  focusActive,
}: {
  edges: ConstellationEdge3D[];
  focusActive: boolean;
}) {
  const layers = useMemo(() => {
    const proximity: ConstellationEdge3D[] = [];
    const infrastructure: ConstellationEdge3D[] = [];
    const lastmile: ConstellationEdge3D[] = [];
    const orbital: ConstellationEdge3D[] = [];
    for (const e of edges) {
      if (e.edgeType === 'infrastructure') infrastructure.push(e);
      else if (e.edgeType === 'lastmile') lastmile.push(e);
      else if (e.edgeType === 'orbital') orbital.push(e);
      else proximity.push(e);
    }
    return { proximity, infrastructure, lastmile, orbital };
  }, [edges]);

  if (edges.length === 0) return null;

  return (
    <>
      <EdgeLayer edges={layers.proximity} focusActive={focusActive} edgeType="proximity" />
      <EdgeLayer edges={layers.lastmile} focusActive={focusActive} edgeType="lastmile" />
    </>
  );
}

// ---------------------------------------------------------------------------
// NeuralMesh — Gossamer threads connecting nearby nodes
// ---------------------------------------------------------------------------

/**
 * Very faint lines connecting nodes within proximity,
 * creating a neural network / synapse visual throughout the constellation.
 * Opacity is very low (0.03-0.06) so it reads as texture, not structure.
 */
export function NeuralMesh({
  nodes,
  focusActive,
}: {
  nodes: ConstellationNode3D[];
  focusActive: boolean;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const maxConnections = 600;
    let count = 0;

    // Connect each node to its 1-2 nearest neighbors within range
    for (let i = 0; i < nodes.length && count < maxConnections; i++) {
      const a = nodes[i];
      if (a.nodeType === 'user') continue;

      let nearest: { dist: number; pos: [number, number, number] } | null = null;

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        if (b.nodeType === 'user') continue;
        const dx = a.position[0] - b.position[0];
        const dy = a.position[1] - b.position[1];
        const dz = a.position[2] - b.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 2.5) {
          positions.push(...a.position, ...b.position);
          count++;
          if (count >= maxConnections) break;
        } else if (dist < 4 && (!nearest || dist < nearest.dist)) {
          nearest = { dist, pos: b.position };
        }
      }

      // Add the nearest neighbor connection if no close ones found
      if (nearest && count < maxConnections) {
        positions.push(...a.position, ...nearest.pos);
        count++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#8ecae6"
        transparent
        opacity={focusActive ? 0.01 : 0.04}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}
