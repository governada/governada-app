'use client';

/**
 * useDeviceCapability — Detect device GPU tier and touch capability.
 *
 * Used by GlobeLayout to choose between 3D WebGL constellation
 * and 2D canvas fallback for low-end devices.
 */

import { useState, useEffect } from 'react';

export type GPUTier = 'low' | 'mid' | 'high';

export interface DeviceCapability {
  gpuTier: GPUTier;
  isTouch: boolean;
  isMobile: boolean;
  /** True when 2D fallback should be used instead of WebGL */
  use2D: boolean;
}

function estimateGPUTier(): GPUTier {
  if (typeof window === 'undefined') return 'mid';

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return 'low';

  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase() : '';

  // Software renderers — always fallback to 2D
  if (/swiftshader|llvmpipe|mesa|microsoft basic/i.test(renderer)) return 'low';

  // Very low memory devices
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (maxTextureSize < 4096) return 'low';

  // Mobile GPUs — capable but throttled
  if (/adreno|mali|powervr|apple gpu/i.test(renderer)) {
    return window.innerWidth < 768 ? 'mid' : 'high';
  }

  if (window.innerWidth < 768) return 'mid';
  return 'high';
}

function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export function useDeviceCapability(): DeviceCapability {
  const [capability, setCapability] = useState<DeviceCapability>({
    gpuTier: 'mid',
    isTouch: false,
    isMobile: false,
    use2D: false,
  });

  useEffect(() => {
    const gpuTier = estimateGPUTier();
    const isTouch = detectTouch();
    const isMobile = detectMobile();

    // Use 2D fallback when WebGL is unavailable or device is very low-end
    const use2D = gpuTier === 'low';

    setCapability({ gpuTier, isTouch, isMobile, use2D });
  }, []);

  return capability;
}
