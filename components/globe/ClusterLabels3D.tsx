/**
 * ClusterLabels3D — camera-tracked faction labels inside the R3F Canvas.
 *
 * Renders as `<Html>` elements from drei, positioned at each cluster's
 * centroid3D. Labels are HIDDEN at the default overview zoom and only
 * appear when the user zooms in (via Seneca prompts or exploration).
 *
 * Visibility is based on camera distance to scene origin — all labels
 * appear/disappear together based on zoom level, not per-label proximity.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

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

  useFrame(() => {
    if (!htmlRef.current) return;

    // Zoom-gated: hidden at overview (camera far from origin), visible when zoomed in.
    // Camera distance to scene center determines ALL label visibility uniformly.
    const distToOrigin = camera.position.length();
    // Hidden above 13 units (overview), fully visible below 10 units (zoomed in)
    const opacity = Math.max(0, Math.min(1, (13 - distToOrigin) / 3));
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
      <div ref={htmlRef} className="whitespace-nowrap text-center" style={{ opacity: 0 }}>
        <div className="font-mono text-[11px] font-medium text-white/50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {cluster.name}
        </div>
        <div className="font-mono text-[9px] text-white/30">{cluster.memberCount} DReps</div>
      </div>
    </Html>
  );
}
