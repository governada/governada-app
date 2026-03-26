'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DelegationBondProps {
  userPosition: [number, number, number];
  drepPosition: [number, number, number];
  driftScore: number;
  visible: boolean;
}

const TEAL = new THREE.Color('#2dd4bf');
const AMBER = new THREE.Color('#f59e0b');
const CORAL = new THREE.Color('#ef4444');

function getDriftColor(driftScore: number): THREE.Color {
  const color = new THREE.Color();
  if (driftScore < 15) {
    color.copy(TEAL);
  } else if (driftScore <= 40) {
    const t = (driftScore - 15) / 25;
    color.copy(TEAL).lerp(AMBER, t);
  } else {
    const t = Math.min((driftScore - 40) / 30, 1);
    color.copy(AMBER).lerp(CORAL, t);
  }
  return color;
}

const vertexShader = /* glsl */ `
  varying float vProgress;

  void main() {
    // Use UV.x as progress along the tube (0-1)
    vProgress = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDriftScore;
  uniform vec3 uColor;

  varying float vProgress;

  void main() {
    // Animated opacity wave traveling from user (0) to DRep (1)
    float wave = sin(vProgress * 6.28 - uTime * 2.0);
    float opacity = 0.4 + 0.5 * (0.5 + 0.5 * wave);

    // Fade at endpoints for smooth entry/exit
    float edgeFade = smoothstep(0.0, 0.08, vProgress) * smoothstep(1.0, 0.92, vProgress);
    opacity *= edgeFade;

    // Slightly brighter at higher drift to draw attention
    float brightness = 1.0 + uDriftScore * 0.3;

    gl_FragColor = vec4(uColor * brightness, opacity);
  }
`;

export function DelegationBond({
  userPosition,
  drepPosition,
  driftScore,
  visible,
}: DelegationBondProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, color } = useMemo(() => {
    const start = new THREE.Vector3(...userPosition).normalize();
    const end = new THREE.Vector3(...drepPosition).normalize();

    // Compute globe radius from the original positions (average magnitude)
    const radiusStart = new THREE.Vector3(...userPosition).length();
    const radiusEnd = new THREE.Vector3(...drepPosition).length();
    const globeRadius = (radiusStart + radiusEnd) / 2;
    const arcRadius = globeRadius + 0.15;

    // Spherical interpolation (slerp) to create great-circle arc points
    const points: THREE.Vector3[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = new THREE.Vector3()
        .copy(start)
        .lerp(end, t)
        .normalize()
        .multiplyScalar(arcRadius);
      // Use proper slerp for great-circle path
      const omega = Math.acos(Math.min(1, start.dot(end)));
      if (omega > 0.001) {
        const sinOmega = Math.sin(omega);
        const a = Math.sin((1 - t) * omega) / sinOmega;
        const b = Math.sin(t * omega) / sinOmega;
        point
          .set(a * start.x + b * end.x, a * start.y + b * end.y, a * start.z + b * end.z)
          .multiplyScalar(arcRadius);
      }
      points.push(point);
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 32, 0.03, 8, false);
    const driftColor = getDriftColor(driftScore);

    return { geometry: tubeGeometry, color: driftColor };
  }, [userPosition, drepPosition, driftScore]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDriftScore: { value: driftScore / 100 },
      uColor: { value: color },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Update uniforms when props change
  useFrame((_, delta) => {
    if (!materialRef.current || !visible) return;
    materialRef.current.uniforms.uTime.value += delta;
    materialRef.current.uniforms.uDriftScore.value = driftScore / 100;
    materialRef.current.uniforms.uColor.value.copy(color);
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
