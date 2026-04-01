/**
 * GlobeEffects — Visual effect components that react to FocusState changes.
 *
 * Includes:
 * - MatchedEdgeGlow: Energy between matched/focused nodes
 * - FlyToParticles: Particle stream from camera to target on match reveal
 * - GloryRing: Golden torus ring around the #1 match result
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import type { FocusState } from '@/lib/globe/types';
import { MATCH_COLOR } from '@/lib/globe/types';
import { PULSE_VERT, PULSE_FRAG } from '@/lib/globe/shaders';

// ---------------------------------------------------------------------------
// MatchedEdgeGlow — Energy between matched/focused nodes
// ---------------------------------------------------------------------------

export function MatchedEdgeGlow({
  nodes,
  focus,
}: {
  nodes: ConstellationNode3D[];
  focus: FocusState;
}) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const matchedEdges = useMemo(() => {
    if (focus.focusedIds.size < 2) return null;
    // Build edges between nearby focused nodes (within distance 4)
    const matched = nodes.filter((n) => focus.focusedIds.has(n.id));
    if (matched.length < 2) return null;

    const positions: number[] = [];
    const intensityArr: number[] = [];
    const maxEdges = 80; // cap for performance
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
        const avg = ((focus.intensities.get(a.id) ?? 0) + (focus.intensities.get(b.id) ?? 0)) / 2;
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
  }, [nodes, focus]);

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
        color={focus.focusColor}
        transparent
        opacity={0.1}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

// ---------------------------------------------------------------------------
// FlyToParticles — Particle stream from camera to target on match reveal
// ---------------------------------------------------------------------------

const FLY_PARTICLE_COUNT = 30;

export function FlyToParticles({
  target,
  active,
}: {
  target: [number, number, number] | null;
  active: boolean;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const startTimesRef = useRef(new Float32Array(FLY_PARTICLE_COUNT));
  const activatedRef = useRef(false);
  const cameraStartRef = useRef<[number, number, number]>([0, 3, 14]);

  // On activation, capture camera position and stagger start times
  useEffect(() => {
    if (active && target) {
      activatedRef.current = true;
      for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
        startTimesRef.current[i] = -1; // will be set in first frame
      }
    } else {
      activatedRef.current = false;
    }
  }, [active, target]);

  useFrame(({ camera, clock }) => {
    const geo = geoRef.current;
    if (!geo || !target || !activatedRef.current) return;

    const positions = geo.getAttribute('position') as THREE.BufferAttribute | null;
    const alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    if (!positions || !alphas) return;

    const now = clock.getElapsedTime();

    // Capture camera start on first frame
    if (startTimesRef.current[0] < 0) {
      cameraStartRef.current = [camera.position.x, camera.position.y, camera.position.z];
      for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
        startTimesRef.current[i] = now + i * 0.03; // 30ms stagger
      }
    }

    const [sx, sy, sz] = cameraStartRef.current;
    const [tx, ty, tz] = target;
    let anyActive = false;

    for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
      const elapsed = now - startTimesRef.current[i];
      if (elapsed < 0) {
        // Not started yet
        positions.setXYZ(i, sx, sy, sz);
        alphas.setX(i, 0);
        anyActive = true;
        continue;
      }

      const t = Math.min(elapsed / 0.8, 1); // 800ms travel
      // Ease-in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      positions.setXYZ(i, sx + (tx - sx) * eased, sy + (ty - sy) * eased, sz + (tz - sz) * eased);

      // Fade: ramp up then fade out
      const alpha = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
      alphas.setX(i, alpha * 0.8);

      if (t < 1) anyActive = true;
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;

    // Auto-deactivate when all particles are done
    if (!anyActive) {
      activatedRef.current = false;
    }
  });

  const buffers = useMemo(() => {
    const positions = new Float32Array(FLY_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(FLY_PARTICLE_COUNT).fill(0.06);
    const alphas = new Float32Array(FLY_PARTICLE_COUNT).fill(0);
    const colors = new Float32Array(FLY_PARTICLE_COUNT * 3);
    const matchCol = new THREE.Color(MATCH_COLOR);
    for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
      colors[i * 3] = matchCol.r * 2.5;
      colors[i * 3 + 1] = matchCol.g * 2.5;
      colors[i * 3 + 2] = matchCol.b * 2.5;
    }
    return { positions, sizes, alphas, colors };
  }, []);

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[buffers.alphas, 1]} />
        <bufferAttribute attach="attributes-aPulseColor" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={PULSE_VERT}
        fragmentShader={PULSE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// GloryRing — Golden torus ring around the #1 match result during reveal
// ---------------------------------------------------------------------------

/**
 * Fades in, gently pulses in scale, and emits golden light via additive blending.
 */
export function GloryRing({
  target,
  active,
}: {
  target: [number, number, number] | null;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (active) startTimeRef.current = 0; // reset on activation
  }, [active]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current || !target || !active) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }

    const mesh = meshRef.current;
    const mat = materialRef.current;

    if (startTimeRef.current === 0) startTimeRef.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - startTimeRef.current;

    // Fade in over 0.5s
    const fadeIn = Math.min(elapsed / 0.5, 1);
    // Pronounced pulse (0.85-1.15 scale oscillation)
    const pulse = 1 + Math.sin(elapsed * 3) * 0.15;

    mesh.visible = true;
    mesh.position.set(target[0], target[1], target[2]);
    mesh.scale.setScalar(pulse * fadeIn);
    // Face the camera by rotating to be perpendicular to the view direction
    mesh.rotation.x = Math.PI * 0.5 + Math.sin(elapsed * 0.8) * 0.08;
    mesh.rotation.z = elapsed * 0.3;
    mat.opacity = fadeIn * 0.5; // more prominent celebration ring
  });

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false}>
      <torusGeometry args={[0.5, 0.02, 12, 36]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#f5c542"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
