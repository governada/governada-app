/**
 * Constellation layout engine — PCA-based 3D positioning.
 *
 * Maps governance participants into free 3D space based on their 6D alignment
 * vectors. Spatial proximity = alignment proximity. No spherical constraint.
 *
 * Positioning model:
 *   1. 6 alignment dimensions → weighted angular direction (XZ plane)
 *   2. Alignment magnitude → outward distance (generalists near center)
 *   3. Specialization strength → Y-axis spread (specialists higher/lower)
 *   4. Soft normalization + jitter for readability
 *   5. Single-pass repulsion to prevent node pile-up
 *
 * All entity types (DRep, CC, SPO) use the same positionByAlignment() function.
 */

import type {
  ConstellationNode3D,
  ConstellationEdge3D,
  LayoutResult,
  GovernanceNodeType,
} from './types';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { getDimensionOrder } from '@/lib/drepIdentity';

const DIMS = getDimensionOrder();

// 6 dimensions → 6 angular directions in the XZ plane (60° apart)
const DIM_ANGLES: number[] = DIMS.map((_, i) => (i / DIMS.length) * Math.PI * 2 - Math.PI);

/** Soft boundary for camera framing — not a hard limit */
export const CONSTELLATION_EXTENT = 10;

const MIN_VISIBLE_SCALE = 0.08;
const MAX_VISIBLE_SCALE = 0.18;
const SPO_SCALE_FACTOR = 0.6;
const CC_SCALE_FACTOR = 0.7;
const SPO_LIMIT = 400;

// Minimum separation between nodes (prevents pile-up)
const MIN_SEPARATION = 0.3;

export interface LayoutInput {
  id: string;
  fullId: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
  nodeType: GovernanceNodeType;
  geoLat?: number;
  geoLon?: number;
  adaAmount?: number;
  drepStatus?: string;
  delegatorCount?: number;
  voteCount?: number;
  fidelityGrade?: string;
}

/**
 * Position a node in 3D space based on its 6D alignment vector.
 *
 * 1. Compute weighted direction in XZ plane from alignment scores
 * 2. Magnitude = how far from center (generalists near center, specialists outward)
 * 3. Y-axis = specialization direction (hemisphere determined by hash)
 * 4. Deterministic jitter for readability
 */
function positionByAlignment(input: LayoutInput): [number, number, number] {
  const scores = input.alignments;
  const hash = simpleHash(input.id);
  const hashNorm = (hash % 10000) / 10000;
  const hashLat = (((hash >> 8) % 1000) / 1000 - 0.5) * 2; // -1 to 1

  // Weighted direction from alignment scores (XZ plane)
  let wx = 0;
  let wz = 0;
  let totalWeight = 0;
  for (let i = 0; i < DIMS.length; i++) {
    const score = scores[i] ?? 50;
    const deviation = score - 50; // -50 to +50
    const weight = Math.abs(deviation);
    const angle = DIM_ANGLES[i];
    // Use deviation (not abs) so high vs low scores push in opposite directions
    wx += Math.cos(angle) * deviation;
    wz += Math.sin(angle) * deviation;
    totalWeight += weight;
  }

  // Normalize direction and compute outward distance
  const dirMagnitude = Math.sqrt(wx * wx + wz * wz);
  let nx: number;
  let nz: number;

  if (dirMagnitude < 1) {
    // Generalist (all near 50) — position with hash-based spread near center
    const hashAngle = hashNorm * Math.PI * 2 - Math.PI;
    nx = Math.cos(hashAngle);
    nz = Math.sin(hashAngle);
  } else {
    nx = wx / dirMagnitude;
    nz = wz / dirMagnitude;
  }

  // Outward distance: proportional to alignment strength
  // Generalists (totalWeight < 10) cluster within 1-3 units of center
  // Specialists (totalWeight > 100) extend to 6-9 units
  const maxWeight = DIMS.length * 50; // theoretical max: all scores at 0 or 100
  const strengthNorm = Math.min(1, totalWeight / (maxWeight * 0.6)); // normalize, cap at 0.6 of theoretical max
  const baseDistance = 1.5 + strengthNorm * 7; // range 1.5 - 8.5

  // Jitter: ±15% of distance for readability
  const jitter = 1 + (hashNorm - 0.5) * 0.3;
  const distance = baseDistance * jitter;

  // XZ position
  const x = nx * distance;
  const z = nz * distance;

  // Y-axis: specialization pushes toward poles, generalists near equator
  const specialization = Math.min(1, totalWeight / (DIMS.length * 30));
  const ySign = hashLat >= 0 ? 1 : -1;
  const y = ySign * specialization * 4 + hashLat * 0.8; // range roughly -5 to +5

  return [
    clamp(x, -CONSTELLATION_EXTENT, CONSTELLATION_EXTENT),
    clamp(y, -CONSTELLATION_EXTENT * 0.7, CONSTELLATION_EXTENT * 0.7),
    clamp(z, -CONSTELLATION_EXTENT, CONSTELLATION_EXTENT),
  ];
}

/**
 * Single-pass repulsion: push overlapping nodes apart.
 * O(n²) but fast for <2000 nodes (each check is just distance + nudge).
 */
function applyRepulsion(nodes: ConstellationNode3D[]): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.position[0] - b.position[0];
      const dy = a.position[1] - b.position[1];
      const dz = a.position[2] - b.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < MIN_SEPARATION && dist > 0.001) {
        const push = (MIN_SEPARATION - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        a.position[0] += nx * push;
        a.position[1] += ny * push;
        a.position[2] += nz * push;
        b.position[0] -= nx * push;
        b.position[1] -= ny * push;
        b.position[2] -= nz * push;
      }
    }
  }
}

export function computeGlobeLayout(inputs: LayoutInput[], nodeLimit: number): LayoutResult {
  const drepInputs = inputs.filter((n) => n.nodeType === 'drep');
  const spoInputs = inputs.filter((n) => n.nodeType === 'spo').slice(0, SPO_LIMIT);
  const ccInputs = inputs.filter((n) => n.nodeType === 'cc');

  const sorted = [...drepInputs].sort((a, b) => b.power - a.power);
  const active = sorted.slice(0, nodeLimit);

  const nodes: ConstellationNode3D[] = [];
  const nodeMap = new Map<string, ConstellationNode3D>();

  // DReps — positioned by alignment
  for (const input of active) {
    const pos = positionByAlignment(input);
    const baseScale = MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE);
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale: baseScale,
      depth: Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2) / CONSTELLATION_EXTENT,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // CC members — same positioning, slightly smaller scale
  for (const input of ccInputs) {
    const pos = positionByAlignment(input);
    const scale = MAX_VISIBLE_SCALE * CC_SCALE_FACTOR;
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale,
      depth: Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2) / CONSTELLATION_EXTENT,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // SPOs — same positioning as DReps, with SPO scale factor
  for (const input of spoInputs) {
    const pos = positionByAlignment(input);
    const baseScale =
      (MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE)) *
      SPO_SCALE_FACTOR;
    const scoreNorm = Math.max(0, Math.min(1, (input.score - 30) / 70));
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale: baseScale * (0.7 + scoreNorm * 0.6),
      depth: Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2) / CONSTELLATION_EXTENT,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // Single-pass repulsion to prevent pile-up
  applyRepulsion(nodes);

  // Edges now computed client-side from cluster data
  return { nodes, edges: [], nodeMap };
}

/**
 * Position by alignment — exported for use by MatchUserNode and focus engine.
 */
export { positionByAlignment };

export function sphereToCartesian(
  lat: number,
  lon: number,
  radius: number,
): [number, number, number] {
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
  ];
}

function dist3D(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
