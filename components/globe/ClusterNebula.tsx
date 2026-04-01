/**
 * ClusterNebula — Soft volumetric glow behind each governance cluster.
 *
 * One large, low-opacity sprite per cluster positioned at its centroid.
 * Creates the gas-cloud-around-star-forming-regions look that replaces
 * the atmosphere's "this is cohesive" signal at the local level.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeCircleTexture } from '@/lib/globe/helpers';
import { getSharedFocus, getSharedFocusVersion } from '@/lib/globe/focusState';

interface ClusterNebulaData {
  centroid3D: [number, number, number];
  /** Number of members — affects nebula size */
  memberCount: number;
  /** Color tint (hex) based on dominant alignment dimension */
  color?: string;
}

const DEFAULT_NEBULA_COLOR = '#2dd4bf'; // teal to match DRep nodes

export function ClusterNebulae({ clusters }: { clusters: ClusterNebulaData[] }) {
  const texture = useMemo(() => makeNebulaTexture(), []);
  const groupRef = useRef<THREE.Group>(null);
  const focusVersionRef = useRef(0);

  // Dim nebulae during focus mode
  useFrame(() => {
    if (!groupRef.current) return;
    const version = getSharedFocusVersion();
    if (version !== focusVersionRef.current) {
      focusVersionRef.current = version;
      const focus = getSharedFocus();
      const targetOpacity = focus.active ? 0.008 : 0.04;
      // Apply to all sprite children
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Sprite && child.material) {
          (child.material as THREE.SpriteMaterial).opacity = targetOpacity;
        }
      });
    }
  });

  if (!clusters.length) return null;

  return (
    <group ref={groupRef}>
      {clusters.map((cluster, i) => {
        // Size proportional to sqrt of member count (avoid huge nebulae for large clusters)
        const size = 3 + Math.sqrt(cluster.memberCount) * 0.8;
        const color = cluster.color || DEFAULT_NEBULA_COLOR;

        return (
          <sprite key={i} position={cluster.centroid3D} scale={[size, size, 1]}>
            <spriteMaterial
              map={texture}
              color={color}
              transparent
              opacity={0.04}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        );
      })}
    </group>
  );
}

/** Generate a Gaussian-falloff circle texture for nebula sprites */
function makeNebulaTexture(): THREE.Texture {
  const size = 128;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return new THREE.Texture();

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Radial gradient: white center → transparent edge (Gaussian-like falloff)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
  gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.03)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
