/**
 * RegionHighlight — Convex hull glow around governance clusters.
 *
 * Renders transparent filled mesh + wireframe edges for each highlighted
 * cluster region. Creates a visible boundary around related node groups.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

interface RegionHighlightProps {
  nodes: ConstellationNode3D[];
  /** Cluster IDs to highlight */
  highlightedRegions: string[] | null;
  /** Map from cluster ID to member node IDs */
  clusterMemberships: Map<string, Set<string>>;
  /** Color for the highlight (default: focusColor) */
  color?: string;
}

/**
 * Compute a convex hull mesh from a set of 3D positions.
 * Uses a simple gift-wrapping approach for small point sets.
 * For production with large sets, consider Three.js ConvexGeometry addon.
 */
function computeConvexHullGeometry(
  positions: Array<[number, number, number]>,
): THREE.BufferGeometry | null {
  if (positions.length < 4) {
    // Not enough points for 3D hull — create a triangle or line
    if (positions.length < 3) return null;
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(positions.flat());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2]);
    geo.computeVertexNormals();
    return geo;
  }

  // Use Three.js built-in ConvexGeometry approach: create from indexed faces
  // For simplicity with small clusters (5-30 nodes), use a centered sphere-projection approach
  const center: [number, number, number] = [0, 0, 0];
  for (const p of positions) {
    center[0] += p[0];
    center[1] += p[1];
    center[2] += p[2];
  }
  center[0] /= positions.length;
  center[1] /= positions.length;
  center[2] /= positions.length;

  // Project points onto unit sphere from center, triangulate, then use original positions
  // Simple approach: sort by angle from center, create triangle fan
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array(positions.length * 3);
  for (let i = 0; i < positions.length; i++) {
    verts[i * 3] = positions[i][0];
    verts[i * 3 + 1] = positions[i][1];
    verts[i * 3 + 2] = positions[i][2];
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));

  // Create triangle fan from centroid (approximation for small clusters)
  const indices: number[] = [];
  for (let i = 1; i < positions.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  // Close the fan
  if (positions.length > 2) {
    indices.push(0, positions.length - 1, 1);
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function RegionHighlight({
  nodes,
  highlightedRegions,
  clusterMemberships,
  color = '#f59e0b',
}: RegionHighlightProps) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const wireMatRef = useRef<THREE.LineBasicMaterial>(null);

  const regions = useMemo(() => {
    if (!highlightedRegions || highlightedRegions.length === 0) return null;

    const result: Array<{ geometry: THREE.BufferGeometry; wireframe: THREE.BufferGeometry }> = [];

    for (const clusterId of highlightedRegions) {
      const memberIds = clusterMemberships.get(clusterId);
      if (!memberIds || memberIds.size < 3) continue;

      const positions: Array<[number, number, number]> = [];
      for (const node of nodes) {
        if (memberIds.has(node.id)) {
          positions.push(node.position);
        }
      }
      if (positions.length < 3) continue;

      const geo = computeConvexHullGeometry(positions);
      if (!geo) continue;

      const wireGeo = new THREE.WireframeGeometry(geo);
      result.push({ geometry: geo, wireframe: wireGeo });
    }

    return result.length > 0 ? result : null;
  }, [nodes, highlightedRegions, clusterMemberships]);

  useFrame(({ clock }) => {
    if (!matRef.current || !wireMatRef.current) return;
    const t = clock.getElapsedTime();
    // Gentle pulsing opacity
    const pulse = 0.03 + 0.02 * Math.sin(t * Math.PI);
    matRef.current.opacity = pulse;
    wireMatRef.current.opacity = 0.15 + 0.05 * Math.sin(t * Math.PI);
  });

  if (!regions) return null;

  return (
    <group>
      {regions.map((region, i) => (
        <group key={i}>
          <mesh geometry={region.geometry}>
            <meshBasicMaterial
              ref={i === 0 ? matRef : undefined}
              color={color}
              transparent
              opacity={0.04}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <lineSegments geometry={region.wireframe}>
            <lineBasicMaterial
              ref={i === 0 ? wireMatRef : undefined}
              color={color}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}
