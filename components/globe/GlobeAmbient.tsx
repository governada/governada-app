import { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { seededRandom, makeCircleTexture } from '@/lib/globe/helpers';

// --- Scene sub-components ---

export function RaycastConfig() {
  const raycaster = useThree((s) => s.raycaster);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Three.js raycaster params must be mutated directly
    raycaster.params.Points = { threshold: 1.8 };
  }, [raycaster]);
  return null;
}

// --- Ambient starfield ---

export function AmbientStarfield({ count }: { count: number }) {
  const circleMap = useMemo(() => makeCircleTexture(), []);

  const points = useMemo(() => {
    const rand = seededRandom(42);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 30 + rand() * 50;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        map={circleMap}
        color="#c0d0ff"
        transparent
        opacity={0.5}
        sizeAttenuation
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
