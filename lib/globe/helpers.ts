/**
 * Globe utility functions — shared helpers for constellation rendering.
 */

import * as THREE from 'three';
import { AXIAL_TILT } from './types';

/** Rotate a 3D position around Y-axis, accounting for Earth-like axial tilt */
export function rotateAroundY(
  pos: [number, number, number],
  angle: number,
): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // Rotate around Y
  const x1 = pos[0] * c + pos[2] * s;
  const z1 = -pos[0] * s + pos[2] * c;
  // Apply axial tilt
  const y2 = pos[1] * Math.cos(AXIAL_TILT) - z1 * Math.sin(AXIAL_TILT);
  const z2 = pos[1] * Math.sin(AXIAL_TILT) + z1 * Math.cos(AXIAL_TILT);
  return [x1, y2, z2];
}

/** Promise-based sleep */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Estimate GPU capability tier based on renderer info and screen size */
export function estimateGPUTier(): 'low' | 'mid' | 'high' {
  if (typeof window === 'undefined') return 'mid';
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return 'low';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase() : '';
  if (/swiftshader|llvmpipe|mesa/i.test(renderer)) return 'low';
  if (window.innerWidth < 768) return 'mid';
  return 'high';
}

/** Deterministic pseudo-random number generator */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Create a radial gradient circle texture for starfield points */
export function makeCircleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}
