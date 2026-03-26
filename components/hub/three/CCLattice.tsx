/**
 * CCLattice — Constitutional Committee as a golden great-circle lattice.
 *
 * Replaces the 7 individual CC point nodes with interconnected golden arcs
 * that form a constitutional framework above the globe surface.
 *
 * Performance: All materials are shared (not cloned). Opacity is updated
 * via direct material reference — no scene graph traversal per frame.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const CC_COLOR = new THREE.Color('#fbbf24');
const CC_RADIUS = 10.5;
const ARC_POINTS = 48; // reduced from 64 — still smooth, fewer vertices
const BASE_OPACITY = 0.15;
const GLOW_OPACITY = 0.7;

interface CCLatticeProps {
  ccNodes: ConstellationNode3D[];
  constitutionalActive?: boolean;
  dimmed?: boolean;
}

function generateArcWaypoints(memberIndex: number, totalMembers: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const phaseOffset = (memberIndex / totalMembers) * Math.PI * 2;
  const tiltAngle = Math.PI / 6 + (memberIndex / totalMembers) * (Math.PI / 3);

  for (let i = 0; i <= ARC_POINTS; i++) {
    const t = (i / ARC_POINTS) * Math.PI * 1.5;
    const baseTheta = phaseOffset + t;
    const x = CC_RADIUS * Math.cos(baseTheta) * Math.cos(tiltAngle);
    const y = CC_RADIUS * Math.sin(tiltAngle) * Math.cos(t * 0.5) + CC_RADIUS * 0.3;
    const z = CC_RADIUS * Math.sin(baseTheta) * Math.cos(tiltAngle);
    const len = Math.sqrt(x * x + y * y + z * z);
    points.push(
      new THREE.Vector3(
        (x / len) * CC_RADIUS,
        Math.abs((y / len) * CC_RADIUS),
        (z / len) * CC_RADIUS,
      ),
    );
  }
  return points;
}

function generateCrossArcs(ccNodes: ConstellationNode3D[]): THREE.Vector3[][] {
  const arcs: THREE.Vector3[][] = [];
  const n = ccNodes.length;
  if (n < 2) return arcs;

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const vecA = new THREE.Vector3(...ccNodes[i].position);
    const vecB = new THREE.Vector3(...ccNodes[next].position);
    const points: THREE.Vector3[] = [];
    const crossPoints = 24; // reduced from 32
    for (let j = 0; j <= crossPoints; j++) {
      const t = j / crossPoints;
      const interp = new THREE.Vector3().lerpVectors(vecA, vecB, t);
      interp.normalize().multiplyScalar(CC_RADIUS);
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
  const opacityRef = useRef(BASE_OPACITY);

  // Shared materials — updated by ref, no traverse needed
  const { arcMaterial, crossMaterial, dotMaterial } = useMemo(() => {
    const arc = new THREE.LineBasicMaterial({
      color: CC_COLOR,
      transparent: true,
      opacity: BASE_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cross = new THREE.LineBasicMaterial({
      color: CC_COLOR,
      transparent: true,
      opacity: BASE_OPACITY * 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dot = new THREE.MeshBasicMaterial({
      color: CC_COLOR,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    return { arcMaterial: arc, crossMaterial: cross, dotMaterial: dot };
  }, []);

  // Build line objects using shared materials (no .clone())
  const arcObjects = useMemo(() => {
    if (ccNodes.length === 0) return { lines: [], crosses: [] };

    const memberArcs = ccNodes.map((_, i) => generateArcWaypoints(i, ccNodes.length));
    const crossArcs = generateCrossArcs(ccNodes);

    const lines = memberArcs.map((points) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geo, arcMaterial);
    });
    const crosses = crossArcs.map((points) => {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geo, crossMaterial);
    });

    return { lines, crosses };
  }, [ccNodes, arcMaterial, crossMaterial]);

  // Shared sphere geometry for CC member dots
  const dotGeo = useMemo(() => new THREE.SphereGeometry(0.15, 6, 6), []);

  // Animate opacity via direct material reference — O(1) per frame, no traverse
  useFrame((_, delta) => {
    const targetOpacity = dimmed ? 0.05 : constitutionalActive ? GLOW_OPACITY : BASE_OPACITY;
    const current = opacityRef.current;
    if (Math.abs(current - targetOpacity) < 0.001) return; // skip if already at target

    opacityRef.current = THREE.MathUtils.lerp(current, targetOpacity, delta * 3);
    arcMaterial.opacity = opacityRef.current;
    crossMaterial.opacity = opacityRef.current * 0.6;
    dotMaterial.opacity = constitutionalActive ? 0.8 : opacityRef.current * 2.5;
  });

  if (ccNodes.length === 0) return null;

  return (
    <group>
      {arcObjects.lines.map((lineObj, i) => (
        <primitive key={`arc-${i}`} object={lineObj} />
      ))}
      {arcObjects.crosses.map((lineObj, i) => (
        <primitive key={`cross-${i}`} object={lineObj} />
      ))}
      {ccNodes.map((node) => (
        <mesh
          key={`cc-dot-${node.id}`}
          position={node.position}
          geometry={dotGeo}
          material={dotMaterial}
        />
      ))}
    </group>
  );
}
