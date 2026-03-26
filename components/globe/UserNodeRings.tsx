'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface UserNodeRingsProps {
  position: [number, number, number];
  participation: number; // 0-100
  deliberation: number; // 0-100
  impact: number; // 0-100
  visible: boolean;
}

const RING_COLORS = {
  participation: '#2dd4bf', // Compass Teal
  deliberation: '#a78bfa', // Meridian Violet
  impact: '#f59e0b', // Wayfinder Amber
} as const;

const MAX_DISTANCE = 5; // Rings fade beyond this camera distance

/**
 * UserNodeRings — Miniature governance rings rendered at the user's globe position.
 *
 * Three concentric ring arcs (participation/deliberation/impact) billboarded
 * to always face the camera. Visible when zoomed in, fade at distance.
 * Replaces the hero section GovernanceRings when the globe IS the homepage.
 */
export function UserNodeRings({
  position,
  participation,
  deliberation,
  impact,
  visible,
}: UserNodeRingsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const rings = useMemo(
    () => [
      { score: participation, color: RING_COLORS.participation, radius: 0.3, width: 0.04 },
      { score: deliberation, color: RING_COLORS.deliberation, radius: 0.38, width: 0.035 },
      { score: impact, color: RING_COLORS.impact, radius: 0.45, width: 0.03 },
    ],
    [participation, deliberation, impact],
  );

  // Billboard to camera + distance-based fade
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Billboard: face camera
    group.quaternion.copy(camera.quaternion);

    // Distance-based opacity
    const dist = camera.position.distanceTo(
      new THREE.Vector3(position[0], position[1], position[2]),
    );
    const opacity = dist < MAX_DISTANCE ? 1 - dist / MAX_DISTANCE : 0;
    group.visible = visible && opacity > 0.05;

    // Apply opacity to all ring materials
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = opacity * 0.8;
      }
    });
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={position}>
      {rings.map((ring, i) => {
        // Arc length proportional to score (0-100 → 0-2π)
        const arcLength = (ring.score / 100) * Math.PI * 2;
        const startAngle = -Math.PI / 2; // start from top

        return (
          <mesh key={i} rotation={[0, 0, 0]}>
            <ringGeometry
              args={[
                ring.radius - ring.width / 2,
                ring.radius + ring.width / 2,
                32,
                1,
                startAngle,
                arcLength,
              ]}
            />
            <meshBasicMaterial
              color={ring.color}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
