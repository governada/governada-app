/**
 * CCLattice — Constitutional Committee as a golden great-circle lattice.
 *
 * Each CC member gets a proper great-circle arc on the sphere surface at CC_RADIUS.
 * Arcs are tilted at different angles to create an interweaving lattice pattern.
 * Adjacent members are connected by slerped cross-arcs.
 *
 * Performance: Shared materials, O(1) per-frame opacity updates.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const CC_COLOR = new THREE.Color('#fbbf24');
const CC_RADIUS = 10.5;
const ARC_POINTS = 48;
const BASE_OPACITY = 0.15;
const GLOW_OPACITY = 0.7;

interface CCLatticeProps {
  ccNodes: ConstellationNode3D[];
  constitutionalActive?: boolean;
  dimmed?: boolean;
}

/**
 * Generate a proper great-circle arc on the sphere.
 * Each member's arc is a partial great circle tilted at a unique inclination.
 * The arc spans ~240° (2/3 of a full circle) for visual interest.
 */
function generateArcWaypoints(memberIndex: number, totalMembers: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  // Each member gets a unique ascending node (rotation around Y)
  // and a unique inclination (tilt from equatorial plane)
  const ascendingNode = (memberIndex / totalMembers) * Math.PI * 2;
  // Inclinations spread between 30° and 75° — all above equator emphasis
  const inclination = Math.PI / 6 + (memberIndex / totalMembers) * (Math.PI / 3.5);

  // Arc spans 240° of the great circle
  const arcSpan = (Math.PI * 4) / 3;
  const arcStart = -arcSpan / 2;

  for (let i = 0; i <= ARC_POINTS; i++) {
    const t = arcStart + (i / ARC_POINTS) * arcSpan;

    // Point on the great circle: start in the XZ plane, then apply inclination and rotation
    const x0 = Math.cos(t);
    const z0 = Math.sin(t);

    // Apply inclination (rotate around X axis to tilt the orbit)
    const x1 = x0;
    const y1 = z0 * Math.sin(inclination);
    const z1 = z0 * Math.cos(inclination);

    // Apply ascending node rotation (rotate around Y axis)
    const x2 = x1 * Math.cos(ascendingNode) + z1 * Math.sin(ascendingNode);
    const y2 = y1;
    const z2 = -x1 * Math.sin(ascendingNode) + z1 * Math.cos(ascendingNode);

    // Push to upper hemisphere only (abs y) and scale to radius
    points.push(new THREE.Vector3(x2 * CC_RADIUS, Math.abs(y2) * CC_RADIUS, z2 * CC_RADIUS));
  }

  return points;
}

/**
 * Generate slerped arcs between adjacent CC member positions.
 */
function generateCrossArcs(ccNodes: ConstellationNode3D[]): THREE.Vector3[][] {
  const arcs: THREE.Vector3[][] = [];
  const n = ccNodes.length;
  if (n < 2) return arcs;

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const vecA = new THREE.Vector3(...ccNodes[i].position).normalize();
    const vecB = new THREE.Vector3(...ccNodes[next].position).normalize();

    const points: THREE.Vector3[] = [];
    const steps = 20;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      // Proper spherical interpolation (slerp)
      const interp = new THREE.Vector3()
        .copy(vecA)
        .lerp(vecB, t)
        .normalize()
        .multiplyScalar(CC_RADIUS);
      // Keep in upper hemisphere
      interp.y = Math.abs(interp.y);
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

  // Build line objects using shared materials
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
  const dotGeo = useMemo(() => new THREE.SphereGeometry(0.12, 6, 6), []);

  // Animate opacity via direct material reference — O(1) per frame
  useFrame((_, delta) => {
    const targetOpacity = dimmed ? 0.05 : constitutionalActive ? GLOW_OPACITY : BASE_OPACITY;
    const current = opacityRef.current;
    if (Math.abs(current - targetOpacity) < 0.001) return;

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
