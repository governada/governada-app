/**
 * focusEngine — Pure-function reactive focus engine.
 *
 * Reads a FocusIntent (declarative "what's relevant") and derives:
 *   1. FocusState — what NodePoints renders (dimming, glow, colors)
 *   2. CameraDerived — where the camera should be (target, distance, speed)
 *
 * No React dependencies. No side effects. Fully unit-testable.
 */

import type { FocusState, FocusIntent } from './types';
import { DEFAULT_FOCUS, DEFAULT_ROTATION_SPEED } from './types';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { rotateAroundY } from './helpers';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CameraDerived {
  /** Camera look-at point (centroid of focused nodes, rotated) */
  target: [number, number, number];
  /** Camera position (offset from centroid outward) */
  position: [number, number, number];
  /** Dolly distance from origin */
  distance: number;
  /** Transition duration in seconds */
  transitionSpeed: number;
  /** Globe rotation speed (radians/frame at 60fps baseline) */
  orbitSpeed: number;
}

export interface EngineOutput {
  focus: FocusState;
  camera: CameraDerived | null;
}

// ---------------------------------------------------------------------------
// Camera derivation helpers
// ---------------------------------------------------------------------------

/** Map focus count to camera distance — closer when fewer nodes focused */
export function deriveCameraDistance(
  focusCount: number,
  proximity?: 'overview' | 'cluster' | 'tight' | 'locked',
): number {
  // Explicit proximity overrides count-based derivation
  if (proximity === 'locked') return 3.5;
  if (proximity === 'tight') return 5;

  if (focusCount <= 0) return 14;
  if (focusCount <= 4) return 3 + (focusCount / 4) * 1; // 3-4
  if (focusCount <= 20) return 4 + ((focusCount - 5) / 15) * 2; // 4-6
  if (focusCount <= 100) return 6 + ((focusCount - 20) / 80) * 4; // 6-10
  if (focusCount <= 500) return 10 + ((focusCount - 100) / 400) * 3; // 10-13
  return 13 + Math.min(2, (focusCount - 500) / 500); // 13-15
}

/** Map distance delta to transition duration — bigger moves are slower */
export function deriveTransitionSpeed(distanceDelta: number): number {
  const d = Math.abs(distanceDelta);
  if (d > 5) return 1.5;
  if (d > 2) return 1.0;
  return 0.6;
}

/** Map camera proximity to globe rotation speed */
export function deriveOrbitSpeed(
  proximity: 'overview' | 'cluster' | 'tight' | 'locked' | undefined,
  overrideSpeed?: number,
): number {
  if (overrideSpeed !== undefined) return overrideSpeed;
  switch (proximity) {
    case 'locked':
      return 0;
    case 'tight':
      return DEFAULT_ROTATION_SPEED * 0.05;
    case 'cluster':
      return DEFAULT_ROTATION_SPEED * 0.3;
    case 'overview':
      return DEFAULT_ROTATION_SPEED * 0.6;
    default:
      return DEFAULT_ROTATION_SPEED;
  }
}

// ---------------------------------------------------------------------------
// Alignment resolution — extracted from GlobeConstellation.highlightMatches
// ---------------------------------------------------------------------------

export interface AlignmentResolved {
  focusedIds: Set<string>;
  intensities: Map<string, number>;
  intermediateIds: Map<string, number>;
  activationDelays: Map<string, number>;
}

/**
 * Score nodes by Euclidean distance to an alignment vector and return the
 * top N closest. Produces focused IDs, per-node intensities, "maybe" nodes,
 * and scanning sweep activation delays.
 *
 * Extracted from GlobeConstellation.tsx highlightMatches ref method.
 */
export function resolveAlignmentTopN(
  alignmentVector: number[],
  topN: number,
  nodes: ConstellationNode3D[],
  drepOnly: boolean,
): AlignmentResolved {
  const focusedIds = new Set<string>();
  const intensities = new Map<string, number>();
  const intermediateIds = new Map<string, number>();
  const activationDelays = new Map<string, number>();

  // Score all eligible nodes by distance
  const scored: Array<{ id: string; distance: number }> = [];
  for (const node of nodes) {
    if (drepOnly && node.nodeType !== 'drep') continue;
    let sumSq = 0;
    for (let d = 0; d < 6; d++) {
      const diff = (alignmentVector[d] ?? 50) - (node.alignments[d] ?? 50);
      sumSq += diff * diff;
    }
    scored.push({ id: node.id, distance: Math.sqrt(sumSq) });
  }

  scored.sort((a, b) => a.distance - b.distance);
  const effectiveN = Math.min(topN, scored.length);
  const maxDist = scored[effectiveN - 1]?.distance ?? 1;

  // Top N are focused with distance-based intensity
  for (let i = 0; i < effectiveN; i++) {
    focusedIds.add(scored[i].id);
    intensities.set(scored[i].id, Math.max(0.2, 1 - scored[i].distance / (maxDist * 1.2)));
  }

  // "Maybe" nodes: ranked topN+1 through topN*2 glow faintly
  const maybeEnd = Math.min(topN * 2, scored.length);
  for (let i = topN; i < maybeEnd; i++) {
    const level = 0.1 + 0.4 * (1 - (i - topN) / (maybeEnd - topN));
    intermediateIds.set(scored[i].id, level);
  }

  // Scanning sweep: nodes activate by rank (best matches first)
  const SWEEP_DURATION = 0.6; // seconds
  for (let i = 0; i < scored.length; i++) {
    activationDelays.set(scored[i].id, (i / scored.length) * SWEEP_DURATION);
  }

  return { focusedIds, intensities, intermediateIds, activationDelays };
}

// ---------------------------------------------------------------------------
// Centroid computation
// ---------------------------------------------------------------------------

/**
 * Compute the 3D centroid of focused nodes, rotated by globe angle.
 * Returns null if no matching nodes found.
 */
export function computeFocusCentroid(
  focusedIds: Set<string>,
  nodes: ConstellationNode3D[],
  rotationAngle: number,
): [number, number, number] | null {
  let cx = 0,
    cy = 0,
    cz = 0,
    count = 0;
  for (const node of nodes) {
    if (!focusedIds.has(node.id)) continue;
    const [rx, ry, rz] = rotateAroundY(node.position, rotationAngle);
    cx += rx;
    cy += ry;
    cz += rz;
    count++;
  }
  if (count === 0) return null;
  return [cx / count, cy / count, cz / count];
}

// ---------------------------------------------------------------------------
// Main derivation
// ---------------------------------------------------------------------------

/**
 * Derive FocusState + camera from a FocusIntent.
 *
 * @param intent - Declarative description of what's relevant
 * @param nodes - All constellation nodes (for resolving sentinels)
 * @param rotationAngle - Current globe rotation (for centroid → camera)
 * @param prevDistance - Previous camera distance (for transition speed calc)
 */
export function deriveFromIntent(
  intent: FocusIntent,
  nodes: ConstellationNode3D[],
  rotationAngle: number,
  prevDistance: number = 14,
): EngineOutput {
  // Null intent = engine idle
  if (intent.focusedIds === null) {
    return { focus: { ...DEFAULT_FOCUS }, camera: null };
  }

  // --- Resolve focusedIds sentinel to concrete Set<string> ---
  let resolvedIds: Set<string>;
  let resolvedIntensities = intent.intensities ?? new Map<string, number>();
  let resolvedIntermediate = intent.intermediateIds ?? null;
  let resolvedActivationDelays = intent.activationDelays ?? null;

  if (intent.focusedIds === 'all-dreps') {
    resolvedIds = new Set<string>();
    // Compute shockwave activation delays from radial distance
    const delays = new Map<string, number>();
    for (const node of nodes) {
      if (node.nodeType !== 'drep') continue;
      resolvedIds.add(node.id);
      resolvedIntensities.set(node.id, 0.6);
      // Radial distance for shockwave (normalized 0-0.8s)
      const dist = Math.sqrt(node.position[0] ** 2 + node.position[1] ** 2 + node.position[2] ** 2);
      delays.set(node.id, (dist / 8) * 0.8);
    }
    if (!intent.activationDelays) {
      resolvedActivationDelays = delays;
    }
  } else if (intent.focusedIds === 'all') {
    resolvedIds = new Set(nodes.map((n) => n.id));
  } else if (intent.focusedIds === 'from-alignment') {
    if (!intent.alignmentVector || !intent.topN) {
      return { focus: { ...DEFAULT_FOCUS }, camera: null };
    }
    const resolved = resolveAlignmentTopN(
      intent.alignmentVector,
      intent.topN,
      nodes,
      intent.nodeTypeFilter === 'drep',
    );
    resolvedIds = resolved.focusedIds;
    resolvedIntensities = resolved.intensities;
    resolvedIntermediate = resolved.intermediateIds.size > 0 ? resolved.intermediateIds : null;
    resolvedActivationDelays =
      resolved.activationDelays.size > 0 ? resolved.activationDelays : null;
  } else {
    // Concrete Set<string>
    resolvedIds = intent.focusedIds;
  }

  // --- Build FocusState ---
  const focus: FocusState = {
    active: resolvedIds.size > 0 || intent.forceActive === true,
    focusedIds: resolvedIds,
    intensities: resolvedIntensities,
    scanProgress: intent.scanProgress ?? intent.dimStrength ?? 0,
    colorOverrides: intent.colorOverrides ?? null,
    nodeTypeFilter: intent.nodeTypeFilter ?? null,
    activationDelays: resolvedActivationDelays,
    intermediateIds: resolvedIntermediate,
    userNode: intent.userNode ?? null,
  };

  // --- Derive camera ---
  if (intent.flyToFocus === false) {
    return { focus, camera: null };
  }

  const centroid = computeFocusCentroid(resolvedIds, nodes, rotationAngle);
  if (!centroid) {
    // No matching nodes — set focus but no camera move
    const distance = deriveCameraDistance(0, intent.cameraProximity);
    return {
      focus,
      camera: {
        target: [0, 0, 0],
        position: [0, 3, distance],
        distance,
        transitionSpeed: 1.0,
        orbitSpeed: deriveOrbitSpeed(intent.cameraProximity, intent.orbitSpeedOverride),
      },
    };
  }

  const [cx, cy, cz] = centroid;
  const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  const nx = cx / dir;
  const ny = cy / dir;
  const nz = cz / dir;

  const distance = deriveCameraDistance(resolvedIds.size, intent.cameraProximity);
  const transitionSpeed = deriveTransitionSpeed(distance - prevDistance);
  const orbitSpeed = deriveOrbitSpeed(intent.cameraProximity, intent.orbitSpeedOverride);

  // Camera position: facing the centroid, offset outward
  let camX = nx * distance;
  const camY = ny * distance + 1.5; // slight elevation for depth
  let camZ = nz * distance;

  // Apply approach angle (azimuth rotation around Y) for dive variety
  if (intent.approachAngle) {
    const cos = Math.cos(intent.approachAngle);
    const sin = Math.sin(intent.approachAngle);
    const rx = camX * cos - camZ * sin;
    const rz = camX * sin + camZ * cos;
    camX = rx;
    camZ = rz;
  }

  return {
    focus,
    camera: {
      target: [cx * 0.7, cy * 0.7, cz * 0.7],
      position: [camX, camY, camZ],
      distance,
      transitionSpeed,
      orbitSpeed,
    },
  };
}
