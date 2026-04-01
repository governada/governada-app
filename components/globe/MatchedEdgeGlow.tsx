/**
 * MatchedEdgeGlow — Energy lines between focused/matched nodes.
 *
 * Renders additive-blended line segments between nearby focused nodes,
 * creating a pulsing web of connections during match flow and focus modes.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

export function MatchedEdgeGlow({
  nodes,
  focusedNodeIds,
  intensities,
  focusColor,
}: {
  nodes: ConstellationNode3D[];
  focusedNodeIds: Set<string>;
  intensities: Map<string, number>;
  focusColor: string;
}) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const matchedEdges = useMemo(() => {
    if (focusedNodeIds.size < 2) return null;
    const matched = nodes.filter((n) => focusedNodeIds.has(n.id));
    if (matched.length < 2) return null;

    const positions: number[] = [];
    const intensityArr: number[] = [];
    const maxEdges = 80;
    let count = 0;

    for (let i = 0; i < matched.length && count < maxEdges; i++) {
      for (let j = i + 1; j < matched.length && count < maxEdges; j++) {
        const a = matched[i];
        const b = matched[j];
        const dx = a.position[0] - b.position[0];
        const dy = a.position[1] - b.position[1];
        const dz = a.position[2] - b.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > 4) continue;
        positions.push(...a.position, ...b.position);
        const avg = ((intensities.get(a.id) ?? 0) + (intensities.get(b.id) ?? 0)) / 2;
        intensityArr.push(avg);
        count++;
      }
    }
    if (positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return {
      geometry: geo,
      avgIntensity: intensityArr.reduce((a, b) => a + b, 0) / intensityArr.length,
    };
  }, [nodes, focusedNodeIds, intensities]);

  // Dispose previous geometry to prevent GPU memory leak
  useEffect(() => {
    return () => {
      matchedEdges?.geometry.dispose();
    };
  }, [matchedEdges]);

  useFrame(({ clock }) => {
    if (!matRef.current || !matchedEdges) return;
    const t = clock.getElapsedTime();
    const pulse = 0.05 + matchedEdges.avgIntensity * 0.3 * (0.5 + 0.5 * Math.sin(t * 2));
    matRef.current.opacity = pulse;
  });

  if (!matchedEdges) return null;

  return (
    <lineSegments geometry={matchedEdges.geometry}>
      <lineBasicMaterial
        ref={matRef}
        color={focusColor}
        transparent
        opacity={0.1}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
