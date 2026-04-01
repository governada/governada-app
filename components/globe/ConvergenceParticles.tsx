/**
 * ConvergenceParticles — Multi-source particle streams converging toward a target.
 *
 * Each focused node emits 2-3 particles that travel along quadratic bezier curves
 * toward a single convergence target. Creates a "gathering" effect for match reveals
 * and tool evaluations.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MATCH_COLOR } from '@/lib/globe/types';
import { PULSE_VERT, PULSE_FRAG } from '@/lib/globe/shaders';

const MAX_PARTICLES = 60;
const PARTICLES_PER_SOURCE = 3;
const TRAVEL_TIME = 1.2; // seconds per particle journey
const EMIT_INTERVAL = 0.4; // seconds between emissions per source

interface ConvergenceParticlesProps {
  /** Positions of focused source nodes */
  sourcePositions: Array<[number, number, number]>;
  /** Position of the convergence target */
  targetPosition: [number, number, number] | null;
  /** Whether the effect is active */
  active: boolean;
}

export function ConvergenceParticles({
  sourcePositions,
  targetPosition,
  active,
}: ConvergenceParticlesProps) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const particlesRef = useRef<
    Array<{
      sourceIdx: number;
      startTime: number;
      controlPoint: [number, number, number];
    }>
  >([]);
  const nextEmitRef = useRef(0);
  const emitIndexRef = useRef(0);

  useFrame(({ clock }) => {
    const geo = geoRef.current;
    if (!geo || !active || !targetPosition || sourcePositions.length === 0) return;

    const positions = geo.getAttribute('position') as THREE.BufferAttribute | null;
    const alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    if (!positions || !alphas) return;

    const now = clock.getElapsedTime();
    const particles = particlesRef.current;

    // Emit new particles
    if (now >= nextEmitRef.current && particles.length < MAX_PARTICLES) {
      const sourceIdx = emitIndexRef.current % sourcePositions.length;
      const src = sourcePositions[sourceIdx];

      for (let p = 0; p < PARTICLES_PER_SOURCE && particles.length < MAX_PARTICLES; p++) {
        // Random control point offset for organic bezier curves
        const offset: [number, number, number] = [
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
        ];
        const controlPoint: [number, number, number] = [
          (src[0] + targetPosition[0]) / 2 + offset[0],
          (src[1] + targetPosition[1]) / 2 + offset[1],
          (src[2] + targetPosition[2]) / 2 + offset[2],
        ];
        particles.push({
          sourceIdx,
          startTime: now + p * 0.08, // slight stagger within burst
          controlPoint,
        });
      }

      emitIndexRef.current++;
      nextEmitRef.current = now + EMIT_INTERVAL;
    }

    // Update particle positions
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i >= particles.length) {
        positions.setXYZ(i, 0, 0, 0);
        alphas.setX(i, 0);
        continue;
      }

      const particle = particles[i];
      const elapsed = now - particle.startTime;

      if (elapsed < 0) {
        // Not started yet
        const src = sourcePositions[particle.sourceIdx];
        if (src) positions.setXYZ(i, src[0], src[1], src[2]);
        alphas.setX(i, 0);
        continue;
      }

      const t = Math.min(elapsed / TRAVEL_TIME, 1);
      // Ease-in-out for organic motion
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const src = sourcePositions[particle.sourceIdx] ?? [0, 0, 0];
      const cp = particle.controlPoint;
      const tgt = targetPosition;

      // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      const oneMinusT = 1 - eased;
      const x =
        oneMinusT * oneMinusT * src[0] + 2 * oneMinusT * eased * cp[0] + eased * eased * tgt[0];
      const y =
        oneMinusT * oneMinusT * src[1] + 2 * oneMinusT * eased * cp[1] + eased * eased * tgt[1];
      const z =
        oneMinusT * oneMinusT * src[2] + 2 * oneMinusT * eased * cp[2] + eased * eased * tgt[2];

      positions.setXYZ(i, x, y, z);

      // Fade envelope: ramp up, hold, fade out
      const alpha = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
      alphas.setX(i, alpha * 0.7);
    }

    // Mark completed particles as dead (pool pattern — no array shrinking mid-frame)
    for (let i = particles.length - 1; i >= 0; i--) {
      if (now - particles[i].startTime >= TRAVEL_TIME) {
        particles.splice(i, 1);
      }
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;
  });

  const buffers = useMemo(() => {
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES).fill(0.05);
    const alphas = new Float32Array(MAX_PARTICLES).fill(0);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    const col = new THREE.Color(MATCH_COLOR);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      colors[i * 3] = col.r * 2.0;
      colors[i * 3 + 1] = col.g * 2.0;
      colors[i * 3 + 2] = col.b * 2.0;
    }
    return { positions, sizes, alphas, colors };
  }, []);

  if (!active || !targetPosition) return null;

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
