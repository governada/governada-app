/**
 * GlobePostProcessing — Bloom post-processing for the constellation.
 *
 * Returns null on low quality tier. Accepts an explicit bloom intensity
 * override from FocusState, falling back to overlay-mode-specific values.
 */

import { EffectComposer, Bloom } from '@react-three/postprocessing';

export function GlobePostProcessing({
  quality,
  bloomIntensity,
  overlayColorMode = 'default',
}: {
  quality: 'low' | 'mid' | 'high';
  bloomIntensity: number | null;
  overlayColorMode?: 'default' | 'urgent' | 'network' | 'proposals' | 'ecosystem';
}) {
  if (quality === 'low') return null;

  const intensity =
    bloomIntensity ??
    (overlayColorMode === 'urgent'
      ? 2.2
      : overlayColorMode === 'proposals'
        ? 2.0
        : overlayColorMode === 'network'
          ? 1.8
          : 1.6);

  return (
    <EffectComposer>
      <Bloom
        mipmapBlur
        intensity={intensity}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.9}
        radius={0.95}
      />
    </EffectComposer>
  );
}
