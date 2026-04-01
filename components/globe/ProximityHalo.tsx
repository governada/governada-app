/**
 * ProximityHalo — Soft gradient halo around focused nodes.
 *
 * Renders a separate points layer with larger point sizes and a gaussian
 * falloff shader. Shows "influence radius" around key nodes.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const HALO_VERT = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HALO_FRAG = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    // Gaussian falloff — soft, diffuse glow
    float falloff = exp(-8.0 * dist * dist);
    gl_FragColor = vec4(vColor, vAlpha * falloff * 0.12);
  }
`;

interface ProximityHaloProps {
  nodes: ConstellationNode3D[];
  haloRadii: Map<string, number> | null;
  focusColor: string;
}

export function ProximityHalo({ nodes, haloRadii, focusColor }: ProximityHaloProps) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const pulseRef = useRef(0);

  const haloNodes = useMemo(() => {
    if (!haloRadii || haloRadii.size === 0) return null;
    const result: Array<{ node: ConstellationNode3D; radius: number }> = [];
    for (const node of nodes) {
      const r = haloRadii.get(node.id);
      if (r !== undefined && r > 0) {
        result.push({ node, radius: r });
      }
    }
    return result.length > 0 ? result : null;
  }, [nodes, haloRadii]);

  useFrame(({ clock }) => {
    if (!geoRef.current || !haloNodes) return;
    pulseRef.current = clock.getElapsedTime();

    const alphas = geoRef.current.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    if (!alphas) return;

    const t = pulseRef.current;
    for (let i = 0; i < haloNodes.length; i++) {
      // Gentle breathing: 90-110% opacity oscillation
      const breathe = 0.9 + 0.1 * Math.sin(t * 1.5 + i * 0.7);
      alphas.setX(i, haloNodes[i].radius * breathe);
    }
    alphas.needsUpdate = true;
  });

  const buffers = useMemo(() => {
    if (!haloNodes) return null;
    const count = haloNodes.length;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const col = new THREE.Color(focusColor);

    for (let i = 0; i < count; i++) {
      const { node, radius } = haloNodes[i];
      positions[i * 3] = node.position[0];
      positions[i * 3 + 1] = node.position[1];
      positions[i * 3 + 2] = node.position[2];
      sizes[i] = 0.3 + radius * 0.7; // 3-10x node size
      alphas[i] = radius;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, sizes, alphas, colors, count };
  }, [haloNodes, focusColor]);

  if (!buffers || !haloNodes) return null;

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[buffers.alphas, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={HALO_VERT}
        fragmentShader={HALO_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
