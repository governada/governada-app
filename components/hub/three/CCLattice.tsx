/**
 * CCLattice — Constitutional Committee as a golden great-circle lattice.
 *
 * Replaces the 7 individual CC point nodes with interconnected golden arcs
 * that form a constitutional framework above the globe surface.
 * Each CC member is associated with arc segments that interweave with others,
 * creating a mesh representing the constitutional rule structure.
 *
 * The lattice is normally at ~15% opacity. When constitutional proposals
 * are active, relevant arcs glow brighter.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const CC_COLOR = new THREE.Color('#fbbf24');
const CC_RADIUS = 10.5;
const ARC_POINTS = 64; // points per arc for smooth curves
const BASE_OPACITY = 0.15;
const GLOW_OPACITY = 0.7;

interface CCLatticeProps {
  ccNodes: ConstellationNode3D[];
  /** Whether any active proposals have constitutional implications */
  constitutionalActive?: boolean;
  dimmed?: boolean;
}

/**
 * Generate great-circle arc waypoints for a CC member.
 * Each member gets a unique arc trajectory based on their index,
 * creating overlapping arcs that form a lattice.
 */
function generateArcWaypoints(memberIndex: number, totalMembers: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const phaseOffset = (memberIndex / totalMembers) * Math.PI * 2;

  // Each CC member creates a great-circle arc tilted at a unique angle
  // The arcs overlap and interweave across the sky hemisphere
  const tiltAngle = Math.PI / 6 + (memberIndex / totalMembers) * (Math.PI / 3);

  for (let i = 0; i <= ARC_POINTS; i++) {
    const t = (i / ARC_POINTS) * Math.PI * 1.5; // 270° arc (not full circle)
    const baseTheta = phaseOffset + t;

    // Apply tilt to create varied great-circle paths
    const x = CC_RADIUS * Math.cos(baseTheta) * Math.cos(tiltAngle);
    const y = CC_RADIUS * Math.sin(tiltAngle) * Math.cos(t * 0.5) + CC_RADIUS * 0.3;
    const z = CC_RADIUS * Math.sin(baseTheta) * Math.cos(tiltAngle);

    // Normalize to sphere surface and apply radius
    const len = Math.sqrt(x * x + y * y + z * z);
    points.push(
      new THREE.Vector3(
        (x / len) * CC_RADIUS,
        Math.abs((y / len) * CC_RADIUS), // Keep above equator (positive Y = upper hemisphere)
        (z / len) * CC_RADIUS,
      ),
    );
  }

  return points;
}

/**
 * Generate connecting arcs between adjacent CC members.
 * These "cross-struts" reinforce the lattice structure.
 */
function generateCrossArcs(ccNodes: ConstellationNode3D[]): THREE.Vector3[][] {
  const arcs: THREE.Vector3[][] = [];
  const n = ccNodes.length;
  if (n < 2) return arcs;

  // Connect each member to its 2 nearest neighbors
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const posA = ccNodes[i].position;
    const posB = ccNodes[next].position;

    const vecA = new THREE.Vector3(...posA);
    const vecB = new THREE.Vector3(...posB);

    // Interpolate along the sphere surface (slerp)
    const points: THREE.Vector3[] = [];
    const crossPoints = 32;
    for (let j = 0; j <= crossPoints; j++) {
      const t = j / crossPoints;
      const interp = new THREE.Vector3().lerpVectors(vecA, vecB, t);
      interp.normalize().multiplyScalar(CC_RADIUS);
      // Lift above equator
      interp.y = Math.abs(interp.y) + 0.5;
      interp.normalize().multiplyScalar(CC_RADIUS);
      points.push(interp);
    }
    arcs.push(points);
  }

  return arcs;
}

export function CCLattice({
  ccNodes,
  constitutionalActive = false,
  dimmed = false,
}: CCLatticeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const opacityRef = useRef(BASE_OPACITY);

  // Generate all arc geometries
  const { memberArcs, crossArcs } = useMemo(() => {
    if (ccNodes.length === 0) return { memberArcs: [], crossArcs: [] };

    const memberArcs = ccNodes.map((_, i) => generateArcWaypoints(i, ccNodes.length));
    const crossArcs = generateCrossArcs(ccNodes);

    return { memberArcs, crossArcs };
  }, [ccNodes]);

  // Animate opacity toward target
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const targetOpacity = dimmed ? 0.05 : constitutionalActive ? GLOW_OPACITY : BASE_OPACITY;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 3);

    // Update material opacity on all children
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Line && child.material instanceof THREE.LineBasicMaterial) {
        child.material.opacity = opacityRef.current;
      }
    });
  });

  // Pre-build Three.js Line objects (avoids <line> JSX conflict with SVG)
  const arcObjects = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: CC_COLOR,
      transparent: true,
      opacity: BASE_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const crossMaterial = new THREE.LineBasicMaterial({
      color: CC_COLOR,
      transparent: true,
      opacity: BASE_OPACITY * 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const lines = memberArcs.map((points) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geo, material.clone());
    });

    const crosses = crossArcs.map((points) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geo, crossMaterial.clone());
    });

    return { lines, crosses };
  }, [memberArcs, crossArcs]);

  if (ccNodes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {/* Member arc lines */}
      {arcObjects.lines.map((lineObj, i) => (
        <primitive key={`arc-${i}`} object={lineObj} />
      ))}

      {/* Cross-connecting arcs */}
      {arcObjects.crosses.map((lineObj, i) => (
        <primitive key={`cross-${i}`} object={lineObj} />
      ))}

      {/* Small glow dots at CC member positions (subtler than old point nodes) */}
      {ccNodes.map((node) => (
        <mesh key={`cc-dot-${node.id}`} position={node.position}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial
            color={CC_COLOR}
            transparent
            opacity={constitutionalActive ? 0.8 : 0.4}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
