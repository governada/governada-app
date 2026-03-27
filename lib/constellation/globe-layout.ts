/**
 * Volumetric constellation layout engine.
 *
 * Maps governance participants into a 3D volume bounded by a sphere:
 *   - CC members = distributed sentinels throughout mid-volume (r 3-6)
 *   - Active DReps = inner-mid shell (r 4-6.5), positioned by alignment dimensions
 *   - Regular DReps = mid-outer shell (r 5-7.5)
 *   - SPOs = infrastructure layer (r 5.5-7.5)
 *   - Inactive/retired = periphery (r 7-8)
 *
 * Alignment dimensions map to 6 longitude bands (60° each).
 * Specialization strength maps to latitude spread.
 * Node significance maps to radial depth (closer to center = more significant).
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

// 6 dimensions → 6 longitude sectors, 60° each
const DIM_LONGITUDES: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  DIMS.forEach((dim, i) => {
    map[dim] = (i / DIMS.length) * Math.PI * 2 - Math.PI;
  });
  return map;
})();

export const GLOBE_RADIUS = 8; // sphere boundary — the constellation's edge
const MIN_VISIBLE_SCALE = 0.06;
const MAX_VISIBLE_SCALE = 0.25;
const SPO_SCALE_FACTOR = 0.6;
const CC_SCALE_FACTOR = 1.0; // CC nodes render at standard DRep scale (symbology TBD)
const SPO_LIMIT = 400;

/**
 * Compute the radial depth for a node based on type and significance.
 * Lower radius = closer to center = more significant/active.
 */
function computeVolumetricRadius(input: LayoutInput): number {
  const hash = simpleHash(input.id);
  const hashNorm = (hash % 10000) / 10000; // 0-1 deterministic jitter

  switch (input.nodeType) {
    case 'cc':
      // Distributed sentinels throughout mid-volume
      return 3.0 + hashNorm * 3.0; // range 3-6
    case 'drep': {
      // Inactive/retired DReps drift to the periphery
      if (input.drepStatus === 'Inactive' || input.drepStatus === 'Retired') {
        return 7.0 + hashNorm * 1.0; // range 7-8
      }
      // Top-tier DReps (high score, active) cluster inner-mid
      if (input.score > 70) {
        return 4.0 + (1 - input.score / 100) * 2.5; // range 4-6.5
      }
      // Regular DReps: mid-outer shell
      return 5.0 + (1 - Math.min(1, input.power)) * 2.5; // range 5-7.5
    }
    case 'spo':
      // Infrastructure layer — distributed through outer volume
      return 5.5 + hashNorm * 2.0; // range 5.5-7.5
    default:
      return GLOBE_RADIUS * 0.9; // near boundary
  }
}

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

export function computeGlobeLayout(inputs: LayoutInput[], nodeLimit: number): LayoutResult {
  const drepInputs = inputs.filter((n) => n.nodeType === 'drep');
  const spoInputs = inputs.filter((n) => n.nodeType === 'spo').slice(0, SPO_LIMIT);
  const ccInputs = inputs.filter((n) => n.nodeType === 'cc');

  const sorted = [...drepInputs].sort((a, b) => b.power - a.power);
  const active = sorted.slice(0, nodeLimit);

  const nodes: ConstellationNode3D[] = [];
  const nodeMap = new Map<string, ConstellationNode3D>();

  // DReps — volumetric distribution based on score/activity
  for (const input of active) {
    const [lon, lat] = computeSpherePosition(input);
    const r = computeVolumetricRadius(input);
    const pos = sphereToCartesian(lat, lon, r);
    const baseScale = MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE);
    // Depth compensation: nodes closer to center get slightly larger
    const depthBoost = 1 + ((GLOBE_RADIUS - r) / GLOBE_RADIUS) * 0.4;
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale: baseScale * depthBoost,
      depth: r / GLOBE_RADIUS,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // CC members — distributed sentinels throughout the volume
  const ccNodes: ConstellationNode3D[] = [];
  for (const input of ccInputs) {
    const [lon, lat] = computeSpherePosition(input);
    const r = computeVolumetricRadius(input);
    const pos = sphereToCartesian(lat, lon, r);
    const depthBoost = 1 + ((GLOBE_RADIUS - r) / GLOBE_RADIUS) * 0.4;
    const scale = MAX_VISIBLE_SCALE * CC_SCALE_FACTOR * depthBoost;
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale,
      depth: r / GLOBE_RADIUS,
    };
    ccNodes.push(node);
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // SPOs — infrastructure layer, volumetric depth
  const spoNodes: ConstellationNode3D[] = [];
  for (let i = 0; i < spoInputs.length; i++) {
    const input = spoInputs[i];
    let lat: number;
    let lon: number;

    if (input.geoLat != null && input.geoLon != null) {
      lat = (input.geoLat * Math.PI) / 180;
      lon = (input.geoLon * Math.PI) / 180;
    } else {
      const hash = simpleHash(input.id);
      lon = (i / spoInputs.length) * Math.PI * 2 - Math.PI;
      lat = (((hash % 140) - 70) / 70) * (Math.PI / 2) * 0.85;
    }

    const r = computeVolumetricRadius(input);
    const pos = sphereToCartesian(lat, lon, r);
    const baseScale =
      (MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE)) *
      SPO_SCALE_FACTOR;
    const scoreNorm = Math.max(0, Math.min(1, (input.score - 30) / 70));
    const depthBoost = 1 + ((GLOBE_RADIUS - r) / GLOBE_RADIUS) * 0.4;
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale: baseScale * (0.7 + scoreNorm * 0.6) * depthBoost,
      geoLat: input.geoLat,
      geoLon: input.geoLon,
      depth: r / GLOBE_RADIUS,
    };
    spoNodes.push(node);
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  const edges = computeGlobeEdges(nodes, spoNodes, ccNodes);
  return { nodes, edges, nodeMap };
}

/**
 * Map alignment scores to longitude/latitude on the globe.
 * - Dominant dimension → base longitude sector
 * - Weighted average of all dimensions → fine-tuned longitude
 * - Specialization strength → latitude (generalists near equator, specialists toward poles)
 */
export function computeSpherePosition(input: LayoutInput): [number, number] {
  const scores = input.alignments;
  const hash = simpleHash(input.id);
  const hashNorm = (hash % 10000) / 10000;

  // Weighted direction from alignment scores
  let wx = 0,
    wy = 0,
    totalWeight = 0;
  for (let i = 0; i < DIMS.length; i++) {
    const score = scores[i] ?? 50;
    const weight = Math.abs(score - 50);
    const angle = DIM_LONGITUDES[DIMS[i]];
    wx += Math.cos(angle) * weight;
    wy += Math.sin(angle) * weight;
    totalWeight += weight;
  }

  // Longitude: weighted direction + jitter
  let lon: number;
  if (totalWeight < 1) {
    lon = hashNorm * Math.PI * 2 - Math.PI;
  } else {
    const dirAngle = Math.atan2(wy, wx);
    const jitter = (hashNorm - 0.5) * (Math.PI / 3); // ±30° fan
    lon = dirAngle + jitter;
  }

  // Latitude: specialization pushes toward poles, generalists near equator
  const specialization = Math.min(1, totalWeight / (DIMS.length * 30));
  const hashLat = (((hash >> 8) % 1000) / 1000 - 0.5) * 2;
  const latSign = hashLat >= 0 ? 1 : -1;
  const lat = latSign * specialization * (Math.PI / 2) * 0.8 + (hashLat * 0.2 * Math.PI) / 2;

  return [lon, clamp(lat, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1)];
}

/**
 * Compute edges for the globe visualization with three distinct layers:
 * - proximity: DRep-DRep connections within same alignment dimension
 * - infrastructure: SPO-SPO mesh backbone (nearest geo neighbors)
 * - lastmile: faint SPO-to-nearest-DRep connections
 */
function computeGlobeEdges(
  allNodes: ConstellationNode3D[],
  spoNodes: ConstellationNode3D[],
  ccNodes: ConstellationNode3D[],
): ConstellationEdge3D[] {
  const edges: ConstellationEdge3D[] = [];
  const drepNodes = allNodes.filter((n) => n.nodeType === 'drep');

  // Layer 0: CC sentinel lattice — geometric connections between sentinels
  for (let i = 0; i < ccNodes.length; i++) {
    for (let j = i + 1; j < ccNodes.length; j++) {
      edges.push({
        from: ccNodes[i].position,
        to: ccNodes[j].position,
        edgeType: 'orbital',
      });
    }
  }

  // Layer 1: Proximity edges among DReps in the same dimension
  const maxProximity = 200;
  for (let i = 0; i < drepNodes.length && edges.length < maxProximity; i++) {
    for (let j = i + 1; j < drepNodes.length && edges.length < maxProximity; j++) {
      const a = drepNodes[i];
      const b = drepNodes[j];
      if (a.dominant !== b.dominant) continue;
      if (dist3D(a.position, b.position) > 3) continue;
      edges.push({ from: a.position, to: b.position, edgeType: 'proximity' });
    }
  }

  // Layer 2: SPO-to-SPO infrastructure mesh — each SPO connects to its 2-3 nearest SPO neighbors
  const maxInfraEdges = 400;
  let infraCount = 0;
  for (let i = 0; i < spoNodes.length && infraCount < maxInfraEdges; i++) {
    const spo = spoNodes[i];
    const nearest = spoNodes
      .filter((_, j) => j !== i)
      .map((n) => ({ node: n, dist: dist3D(spo.position, n.position) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    for (const { node, dist } of nearest) {
      if (dist > 6) continue; // only connect reasonably close SPOs
      // Great-circle arc at the average depth of both endpoints
      const avgR = (dist3DToOrigin(spo.position) + dist3DToOrigin(node.position)) / 2;
      const arcPoints = greatCircleArc(spo.position, node.position, avgR + 0.3, 6);
      for (let k = 0; k < arcPoints.length - 1; k++) {
        edges.push({ from: arcPoints[k], to: arcPoints[k + 1], edgeType: 'infrastructure' });
        infraCount++;
      }
    }
  }

  // Layer 3: Last-mile connections — each SPO to its nearest DRep
  const maxLastMile = 300;
  let lastMileCount = 0;
  for (const spo of spoNodes) {
    if (lastMileCount >= maxLastMile) break;
    if (drepNodes.length === 0) break;
    const nearest = drepNodes
      .map((n) => ({ node: n, dist: dist3D(spo.position, n.position) }))
      .sort((a, b) => a.dist - b.dist)[0];

    if (nearest && nearest.dist < 5) {
      edges.push({
        from: spo.position,
        to: nearest.node.position,
        edgeType: 'lastmile',
      });
      lastMileCount++;
    }
  }

  return edges;
}

/**
 * Generate points along a great-circle arc between two positions,
 * lifted to a given radius (so arcs float above the surface).
 */
function greatCircleArc(
  a: [number, number, number],
  b: [number, number, number],
  radius: number,
  segments: number,
): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Slerp between the two positions
    const x = a[0] * (1 - t) + b[0] * t;
    const y = a[1] * (1 - t) + b[1] * t;
    const z = a[2] * (1 - t) + b[2] * t;
    // Normalize to sphere surface at the given radius
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.001) {
      points.push([x, y, z]);
    } else {
      points.push([(x / len) * radius, (y / len) * radius, (z / len) * radius]);
    }
  }
  return points;
}

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

function dist3DToOrigin(p: [number, number, number]): number {
  return Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
