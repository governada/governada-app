/**
 * GlobeCamera — Camera-related R3F components for the constellation.
 *
 * Extracted from GlobeConstellation.tsx. These run inside the R3F Canvas
 * so they must NOT have a 'use client' directive of their own.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { AXIAL_TILT } from '@/lib/globe/types';

/**
 * Slow continuous rotation to keep the globe feeling alive when idle.
 * Constant angular velocity — no oscillation (oscillation caused motion sickness).
 * ~0.5° per second at 60 fps, completing a full revolution in ~12 minutes.
 */
export function IdleCameraWobble({
  controlsRef,
}: {
  controlsRef: React.RefObject<CameraControls | null>;
}) {
  useFrame(() => {
    if (!controlsRef.current) return;
    // Constant slow rotation — no sinusoidal sway
    controlsRef.current.azimuthAngle += 0.00015;
  });
  return null;
}

/**
 * CinematicCamera — Per-frame smooth camera motion for theatrical choreography.
 * Continuously orbits at configurable speed and smoothly dolly-zooms to target distance.
 * Only active when orbitSpeed > 0 or dollyTarget differs from current.
 */
export function CinematicCamera({
  controlsRef,
  orbitSpeed,
  dollyTarget,
  driftEnabled,
  mouseRef,
}: {
  controlsRef: React.RefObject<CameraControls | null>;
  orbitSpeed: number;
  dollyTarget: number;
  /** When true, adds subtle camera micro-drift — "system is alive" feel */
  driftEnabled?: boolean;
  /** Normalized mouse position for parallax (-1..1). Optional. */
  mouseRef?: React.RefObject<{ x: number; y: number }>;
}) {
  const currentDolly = useRef(14);
  // Smoothed parallax offset (non-accumulating — applied as direct offset)
  const parallaxX = useRef(0);
  const parallaxY = useRef(0);
  const prevParallaxX = useRef(0);
  const prevParallaxY = useRef(0);

  useFrame(({ clock }, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Smooth orbit: per-frame azimuth accumulation (cinematic takes over from idle wobble)
    if (Math.abs(orbitSpeed) > 0.001) {
      controls.azimuthAngle += orbitSpeed * delta;
    }

    // Camera micro-drift: subtle sinusoidal oscillation
    if (driftEnabled && Math.abs(orbitSpeed) < 0.002) {
      const t = clock.getElapsedTime();
      const drift = 0.15 * Math.sin(t * 0.6 * Math.PI);
      controls.azimuthAngle += drift * delta * 0.3;
      controls.polarAngle += drift * delta * 0.15;
    }

    // Mouse parallax: non-accumulating offset (apply delta from previous frame)
    if (mouseRef?.current) {
      const targetX = mouseRef.current.x * 0.3;
      const targetY = mouseRef.current.y * 0.2;
      const smoothFactor = 1 - Math.pow(0.02, delta);
      parallaxX.current += (targetX - parallaxX.current) * smoothFactor;
      parallaxY.current += (targetY - parallaxY.current) * smoothFactor;

      // Apply as delta from previous smoothed value (prevents drift)
      controls.azimuthAngle += parallaxX.current - prevParallaxX.current;
      controls.polarAngle += parallaxY.current - prevParallaxY.current;
      prevParallaxX.current = parallaxX.current;
      prevParallaxY.current = parallaxY.current;
    }

    // Smooth dolly: exponential smoothing toward target distance
    const dollyDiff = dollyTarget - currentDolly.current;
    if (Math.abs(dollyDiff) > 0.05) {
      const factor = 1 - Math.pow(0.05, delta);
      currentDolly.current += dollyDiff * factor;
      controls.dollyTo(currentDolly.current, false);
    }
  });

  return null;
}

/**
 * ConstellationGroup — Container for all constellation content.
 * Applies slow Y-axis rotation and optional breathing animation.
 * No axial tilt (removed with sphere → free-space transition).
 */
export function ConstellationGroup({
  rotationRef,
  speedRef,
  breathing,
  urgency,
  children,
}: {
  rotationRef: React.RefObject<number>;
  speedRef: React.RefObject<number>;
  breathing?: boolean;
  urgency?: number;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const currentSpeedRef = useRef(0);

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      // Smooth rotation speed transitions — eased start/stop instead of abrupt
      const targetSpeed = speedRef.current;
      currentSpeedRef.current +=
        (targetSpeed - currentSpeedRef.current) * (1 - Math.pow(0.01, delta));
      rotationRef.current += delta * currentSpeedRef.current;

      // Apply axial tilt on X, then spin on Y (local)
      groupRef.current.rotation.x = AXIAL_TILT;
      groupRef.current.rotation.y = rotationRef.current;

      // Breathing: gentle rhythmic scale pulse
      if (breathing) {
        const bpm = 8 + ((urgency ?? 30) / 100) * 8;
        const freq = bpm / 60;
        const t = clock.getElapsedTime();
        const phase = (t * freq) % 1;
        const beat =
          phase < 0.1
            ? Math.sin((phase * Math.PI) / 0.1) * 0.003
            : phase < 0.2
              ? Math.sin(((phase - 0.1) * Math.PI) / 0.1) * 0.0015
              : 0;
        groupRef.current.scale.setScalar(1 + beat);
      }
    }
  });

  return <group ref={groupRef}>{children}</group>;
}
