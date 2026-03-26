/**
 * CCCrownRing — Constitutional Committee as a golden crown/halo ring.
 *
 * A thin golden torus floats above the globe with 7 hexagonal medallion
 * nodes embedded in it. Each medallion shows the CC member's fidelity grade
 * and is clickable/hoverable. The ring slowly rotates for a living feel.
 *
 * Visual concept: Saturn's ring meets a crown of governance authority.
 * From egocentric center view, user looks up slightly to see the
 * constitutional crown overhead.
 *
 * Performance: Shared geometries/materials, instanced rendering where possible,
 * O(1) per-frame updates.
 */

import { useMemo, useRef, useCallback } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

// --- Constants ---
const CC_GOLD = new THREE.Color('#fbbf24');
const CC_GOLD_BRIGHT = new THREE.Color('#fcd34d');
const RING_RADIUS = 11; // distance from center to ring center
const RING_TUBE = 0.04; // tube thickness — thin elegant band
const RING_Y = 5.5; // elevated above equator — visible "crown" from center
const MEDALLION_SIZE = 0.45; // hexagon radius
const HOVER_SCALE = 1.4;
const ROTATION_SPEED = 0.02; // radians per second — gentle drift
const SEGMENTS_RADIAL = 96; // smooth ring
const SEGMENTS_TUBE = 8;

// Grade to color intensity mapping
const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', // green
  B: '#84cc16', // lime
  C: '#fbbf24', // amber (default gold)
  D: '#f97316', // orange
  F: '#ef4444', // red
};

interface CCCrownRingProps {
  ccNodes: ConstellationNode3D[];
  dimmed?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
}

/**
 * Create a hexagon shape for medallion geometry.
 */
function createHexagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6; // flat-top hexagon
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/**
 * Create hexagon border wireframe points.
 */
function createHexagonBorderPoints(radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const angle = (Math.PI / 3) * (i % 6) - Math.PI / 6;
    points.push(new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
  }
  return points;
}

/**
 * Individual CC medallion — hexagonal badge with grade indicator.
 * Billboard-faces camera for readability from any angle.
 */
function CCMedallion({
  node,
  angle,
  ringRadius,
  ringY,
  onNodeClick,
  onNodeHover,
  dimmed,
}: {
  node: ConstellationNode3D;
  angle: number;
  ringRadius: number;
  ringY: number;
  onNodeClick?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
  dimmed?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const hoveredRef = useRef(false);
  const scaleRef = useRef(1);
  const glowRef = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);

  // Position on the ring
  const position = useMemo<[number, number, number]>(
    () => [Math.cos(angle) * ringRadius, ringY, Math.sin(angle) * ringRadius],
    [angle, ringRadius, ringY],
  );

  // Shared geometries
  const hexShape = useMemo(() => createHexagonShape(MEDALLION_SIZE), []);
  const hexGeo = useMemo(() => new THREE.ShapeGeometry(hexShape), [hexShape]);
  const hexBorderGeo = useMemo(() => {
    const pts = createHexagonBorderPoints(MEDALLION_SIZE * 1.05);
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const glowGeo = useMemo(
    () => new THREE.ShapeGeometry(createHexagonShape(MEDALLION_SIZE * 1.3)),
    [],
  );

  // Grade-based accent color
  const gradeColor = useMemo(() => {
    const grade = node.fidelityGrade ?? 'C';
    return new THREE.Color(GRADE_COLORS[grade] ?? GRADE_COLORS.C);
  }, [node.fidelityGrade]);

  // Build border line object
  const borderLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: CC_GOLD,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const line = new THREE.Line(hexBorderGeo, mat);
    line.renderOrder = 3;
    return { line, material: mat };
  }, [hexBorderGeo]);

  // Materials
  const fillMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#1a1a2e'),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: gradeColor,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [gradeColor],
  );

  // Billboard + hover animation
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Billboard: face camera
    groupRef.current.quaternion.copy(camera.quaternion);

    // Hover scale animation
    const targetScale = hoveredRef.current ? HOVER_SCALE : 1;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, delta * 8);
    groupRef.current.scale.setScalar(scaleRef.current);

    // Glow pulse on hover
    if (glowRef.current) {
      const targetGlow = hoveredRef.current ? 0.3 : 0;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetGlow, delta * 6);
    }

    // Border brightness on hover
    {
      const mat = borderLine.material;
      const targetOp = dimmed ? 0.2 : hoveredRef.current ? 1.0 : 0.7;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOp, delta * 6);
    }

    // Fill opacity
    const targetFill = dimmed ? 0.3 : hoveredRef.current ? 0.95 : 0.85;
    fillMaterial.opacity = THREE.MathUtils.lerp(fillMaterial.opacity, targetFill, delta * 6);
  });

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      hoveredRef.current = true;
      document.body.style.cursor = 'pointer';
      onNodeHover?.(node);
    },
    [node, onNodeHover],
  );

  const handlePointerOut = useCallback(() => {
    hoveredRef.current = false;
    document.body.style.cursor = 'auto';
    onNodeHover?.(null);
  }, [onNodeHover]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onNodeClick?.(node);
    },
    [node, onNodeClick],
  );

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* Glow behind (grade-colored) */}
        <mesh ref={glowRef} geometry={glowGeo} material={glowMaterial} renderOrder={1} />

        {/* Dark fill */}
        <mesh
          geometry={hexGeo}
          material={fillMaterial}
          renderOrder={2}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />

        {/* Gold border */}
        <primitive object={borderLine.line} />

        {/* Grade indicator dot — small circle at top of hexagon */}
        <mesh position={[0, MEDALLION_SIZE * 0.65, 0.01]} renderOrder={4}>
          <circleGeometry args={[0.08, 12]} />
          <meshBasicMaterial color={gradeColor} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The crown ring itself — a thin golden torus that slowly rotates.
 */
function CrownTorus({ dimmed }: { dimmed?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(0.35);

  const geometry = useMemo(
    () => new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, SEGMENTS_TUBE, SEGMENTS_RADIAL),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: CC_GOLD_BRIGHT,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Gentle rotation
    meshRef.current.rotation.y += ROTATION_SPEED * delta;
    // Opacity transition
    const target = dimmed ? 0.08 : 0.35;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, target, delta * 3);
    material.opacity = opacityRef.current;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, RING_Y, 0]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}

/**
 * Faint connecting lines from each medallion down to the ring plane.
 * Creates the impression that medallions are "set into" the ring.
 */
function MedallionTethers({
  ccNodes,
  dimmed,
}: {
  ccNodes: ConstellationNode3D[];
  dimmed?: boolean;
}) {
  const { lineObjects, sharedMaterial } = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: CC_GOLD,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const objs = ccNodes.map((_, i) => {
      const angle = (i / Math.max(ccNodes.length, 1)) * Math.PI * 2;
      const x = Math.cos(angle) * RING_RADIUS;
      const z = Math.sin(angle) * RING_RADIUS;

      const points = [new THREE.Vector3(x, RING_Y - 0.3, z), new THREE.Vector3(x, RING_Y + 0.3, z)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geo, mat);
    });

    return { lineObjects: objs, sharedMaterial: mat };
  }, [ccNodes]);

  useFrame((_, delta) => {
    const target = dimmed ? 0.05 : 0.2;
    sharedMaterial.opacity = THREE.MathUtils.lerp(sharedMaterial.opacity, target, delta * 3);
  });

  if (ccNodes.length === 0) return null;

  return (
    <group>
      {lineObjects.map((obj, i) => (
        <primitive key={`tether-${i}`} object={obj} />
      ))}
    </group>
  );
}

/**
 * CCCrownRing — Main export.
 *
 * Renders: golden torus ring + hexagonal medallions + connecting tethers.
 * The entire group slowly rotates for a living, orbital feel.
 */
export function CCCrownRing({ ccNodes, dimmed, onNodeClick, onNodeHover }: CCCrownRingProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Gentle rotation of the entire crown assembly
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += ROTATION_SPEED * delta;
  });

  if (ccNodes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {/* The ring itself */}
      <CrownTorus dimmed={dimmed} />

      {/* Tethers from ring to medallions */}
      <MedallionTethers ccNodes={ccNodes} dimmed={dimmed} />

      {/* Medallion nodes embedded in the ring */}
      {ccNodes.map((node, i) => {
        const angle = (i / ccNodes.length) * Math.PI * 2;
        return (
          <CCMedallion
            key={node.id}
            node={node}
            angle={angle}
            ringRadius={RING_RADIUS}
            ringY={RING_Y}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            dimmed={dimmed}
          />
        );
      })}
    </group>
  );
}
