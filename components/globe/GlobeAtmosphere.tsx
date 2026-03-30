/**
 * GlobeAtmosphere — atmospheric glow shell using a fresnel rim-light effect.
 * Rendered as an additive-blended sphere slightly larger than the globe,
 * producing the characteristic edge glow visible on the constellation homepage.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { ATMOSPHERE_VERT, ATMOSPHERE_FRAG } from '@/lib/globe/shaders';

export function GlobeAtmosphere({
  radius,
  color,
  warmColor,
  intensity,
  matchProgress = 0,
}: {
  radius: number;
  color: string;
  warmColor?: string;
  intensity: number;
  matchProgress?: number;
}) {
  const lerpedColor = useMemo(() => {
    if (!warmColor || matchProgress <= 0) return new THREE.Color(color);
    return new THREE.Color(color).lerp(new THREE.Color(warmColor), matchProgress);
  }, [color, warmColor, matchProgress]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: lerpedColor },
      uIntensity: { value: intensity },
    }),
    [lerpedColor, intensity],
  );

  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 48]} />
      <shaderMaterial
        vertexShader={ATMOSPHERE_VERT}
        fragmentShader={ATMOSPHERE_FRAG}
        uniforms={uniforms}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
