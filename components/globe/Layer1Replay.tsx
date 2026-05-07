import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  computeLayer1ReplayAgeMs,
  RATIONALE_FLICKER_BASE_INTENSITY,
  RATIONALE_FLICKER_DURATION_MS,
  RATIONALE_FLICKER_SIZE_MULTIPLIER,
  VOTE_PARTICLE_BASE_SIZE,
  VOTE_PARTICLE_ALPHA,
  VOTE_PARTICLE_COLOR_INTENSITY,
  VOTE_PARTICLE_FADE_MS,
  type Layer1RationaleFlickerPlan,
  type Layer1RenderPlan,
  type Layer1VoteParticlePlan,
  isLayer1ReplayVisible,
} from '@/lib/globe/layer1Constants';
import { PULSE_FRAG, PULSE_VERT } from '@/lib/globe/shaders';

interface Layer1ReplayProps {
  plan: Layer1RenderPlan;
}

const tempColor = new THREE.Color();

function setQuadraticBezierPosition(
  positions: THREE.BufferAttribute,
  index: number,
  particle: Layer1VoteParticlePlan,
  t: number,
) {
  const oneMinusT = 1 - t;
  const x =
    oneMinusT * oneMinusT * particle.from[0] +
    2 * oneMinusT * t * particle.control[0] +
    t * t * particle.to[0];
  const y =
    oneMinusT * oneMinusT * particle.from[1] +
    2 * oneMinusT * t * particle.control[1] +
    t * t * particle.to[1];
  const z =
    oneMinusT * oneMinusT * particle.from[2] +
    2 * oneMinusT * t * particle.control[2] +
    t * t * particle.to[2];

  positions.setXYZ(index, x, y, z);
}

function Layer1VoteParticles({ particles }: { particles: Layer1VoteParticlePlan[] }) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  const buffers = useMemo(() => {
    const positions = new Float32Array(particles.length * 3);
    const sizes = new Float32Array(particles.length);
    const alphas = new Float32Array(particles.length);
    const colors = new Float32Array(particles.length * 3);

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      positions[i * 3] = particle.from[0];
      positions[i * 3 + 1] = particle.from[1];
      positions[i * 3 + 2] = particle.from[2];
      sizes[i] = VOTE_PARTICLE_BASE_SIZE * particle.sizeMultiplier;

      tempColor.set(particle.color);
      colors[i * 3] = tempColor.r * VOTE_PARTICLE_COLOR_INTENSITY;
      colors[i * 3 + 1] = tempColor.g * VOTE_PARTICLE_COLOR_INTENSITY;
      colors[i * 3 + 2] = tempColor.b * VOTE_PARTICLE_COLOR_INTENSITY;
    }

    return { positions, sizes, alphas, colors };
  }, [particles]);

  useFrame(({ clock }) => {
    const geo = geoRef.current;
    if (!geo || particles.length === 0) return;

    const positions = geo.getAttribute('position') as THREE.BufferAttribute | null;
    const alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    if (!positions || !alphas) return;

    const elapsedMs = clock.getElapsedTime() * 1_000;

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const ageMs = computeLayer1ReplayAgeMs(elapsedMs, particle.replayOffsetMs);

      if (!isLayer1ReplayVisible(elapsedMs, particle.replayOffsetMs, VOTE_PARTICLE_FADE_MS)) {
        alphas.setX(i, 0);
        continue;
      }

      const linear = Math.max(0, Math.min(1, ageMs / VOTE_PARTICLE_FADE_MS));
      const eased = 1 - Math.pow(1 - linear, 2);
      setQuadraticBezierPosition(positions, i, particle, eased);
      alphas.setX(i, (1 - linear) * VOTE_PARTICLE_ALPHA * particle.alphaMultiplier);
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;
  });

  if (particles.length === 0) return null;

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

function Layer1RationaleFlickers({ flickers }: { flickers: Layer1RationaleFlickerPlan[] }) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  const buffers = useMemo(() => {
    const positions = new Float32Array(flickers.length * 3);
    const sizes = new Float32Array(flickers.length);
    const alphas = new Float32Array(flickers.length);
    const colors = new Float32Array(flickers.length * 3);

    for (let i = 0; i < flickers.length; i++) {
      const flicker = flickers[i];
      positions[i * 3] = flicker.position[0];
      positions[i * 3 + 1] = flicker.position[1];
      positions[i * 3 + 2] = flicker.position[2];
      sizes[i] = VOTE_PARTICLE_BASE_SIZE * RATIONALE_FLICKER_SIZE_MULTIPLIER;

      tempColor.set(flicker.color);
      colors[i * 3] = tempColor.r * (RATIONALE_FLICKER_BASE_INTENSITY + flicker.emissiveBump);
      colors[i * 3 + 1] = tempColor.g * (RATIONALE_FLICKER_BASE_INTENSITY + flicker.emissiveBump);
      colors[i * 3 + 2] = tempColor.b * (RATIONALE_FLICKER_BASE_INTENSITY + flicker.emissiveBump);
    }

    return { positions, sizes, alphas, colors };
  }, [flickers]);

  useFrame(({ clock }) => {
    const geo = geoRef.current;
    if (!geo || flickers.length === 0) return;

    const alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    if (!alphas) return;

    const elapsedMs = clock.getElapsedTime() * 1_000;

    for (let i = 0; i < flickers.length; i++) {
      const flicker = flickers[i];
      const ageMs = computeLayer1ReplayAgeMs(elapsedMs, flicker.replayOffsetMs);
      if (
        !isLayer1ReplayVisible(elapsedMs, flicker.replayOffsetMs, RATIONALE_FLICKER_DURATION_MS)
      ) {
        alphas.setX(i, 0);
        continue;
      }

      const linear = Math.max(0, Math.min(1, ageMs / RATIONALE_FLICKER_DURATION_MS));
      alphas.setX(i, (1 - linear) * flicker.emissiveBump);
    }

    alphas.needsUpdate = true;
  });

  if (flickers.length === 0) return null;

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

export function Layer1Replay({ plan }: Layer1ReplayProps) {
  return (
    <>
      <Layer1VoteParticles particles={plan.voteParticles} />
      <Layer1RationaleFlickers flickers={plan.rationaleFlickers} />
    </>
  );
}
