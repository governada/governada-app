/**
 * ClusterLabels3D — camera-tracked faction labels inside the R3F Canvas.
 *
 * Renders as `<Html>` elements from drei, positioned at each cluster's
 * centroid3D. Labels move with the globe rotation and fade when the
 * camera is close (to avoid clutter during node inspection).
 *
 * This component is rendered inside TiltedGlobeGroup as a child of
 * ConstellationScene — it participates in the globe's axial tilt
 * and rotation automatically.
 */

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface ClusterLabelData {
  id: string;
  name: string;
  centroid3D: [number, number, number];
  memberCount: number;
}

interface ClusterLabels3DProps {
  clusters: ClusterLabelData[];
}

export function ClusterLabels3D({ clusters }: ClusterLabels3DProps) {
  if (!clusters.length) return null;

  return (
    <>
      {clusters.map((cluster) => (
        <ClusterLabel key={cluster.id} cluster={cluster} />
      ))}
    </>
  );
}

function ClusterLabel({ cluster }: { cluster: ClusterLabelData }) {
  const { camera } = useThree();
  const htmlRef = useRef<HTMLDivElement>(null);
  const position = useMemo(() => new THREE.Vector3(...cluster.centroid3D), [cluster.centroid3D]);

  useFrame(() => {
    if (!htmlRef.current) return;

    // Fade based on camera distance to this label's position
    const dist = camera.position.distanceTo(position);
    // Fully visible at distance > 10, fully hidden at distance < 5
    const opacity = Math.max(0, Math.min(1, (dist - 5) / 5));
    htmlRef.current.style.opacity = String(opacity);
  });

  return (
    <Html
      position={cluster.centroid3D}
      center
      distanceFactor={15}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div ref={htmlRef} className="whitespace-nowrap text-center">
        <div className="font-mono text-[11px] font-medium text-white/50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {cluster.name}
        </div>
        <div className="font-mono text-[9px] text-white/30">{cluster.memberCount} DReps</div>
      </div>
    </Html>
  );
}
