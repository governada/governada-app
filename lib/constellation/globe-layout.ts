/**
 * Globe-based layout engine for the governance constellation.
 *
 * Maps governance participants onto a sphere:
 *   - Core (origin) = governance engine
 *   - CC members = inner mantle shell (radius ~3.5)
 *   - DReps = surface of the globe (radius ~8), positioned by alignment dimensions → lat/lon
 *   - SPOs = infrastructure arcs connecting surface nodes
 *
 * Alignment dimensions map to 6 longitude bands (60° each).
 * Specialization strength maps to latitude spread.
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

const GLOBE_RADIUS = 8;
const CC_RADIUS = 3.5;
const SPO_ARC_RADIUS = GLOBE_RADIUS + 0.3; // slightly above surface
const MIN_VISIBLE_SCALE = 0.06;
const MAX_VISIBLE_SCALE = 0.25;
const SPO_SCALE_FACTOR = 0.6;
const CC_SCALE_FACTOR = 1.15;
const SPO_LIMIT = 400;

interface LayoutInput {
  id: string;
  fullId: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
  nodeType: GovernanceNodeType;
}

export function computeGlobeLayout(inputs: LayoutInput[], nodeLimit: number): LayoutResult {
  const drepInputs = inputs.filter((n) => n.nodeType === 'drep');
  const spoInputs = inputs.filter((n) => n.nodeType === 'spo').slice(0, SPO_LIMIT);
  const ccInputs = inputs.filter((n) => n.nodeType === 'cc');

  const sorted = [...drepInputs].sort((a, b) => b.power - a.power);
  const active = sorted.slice(0, nodeLimit);

  const nodes: ConstellationNode3D[] = [];
  const nodeMap = new Map<string, ConstellationNode3D>();

  // DReps on globe surface
  for (const input of active) {
    const [lon, lat] = computeSpherePosition(input);
    const pos = sphereToCartesian(lat, lon, GLOBE_RADIUS);
    const scale = MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE);
    const node: ConstellationNode3D = { ...input, position: pos, scale };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // CC members — inner mantle shell
  for (let i = 0; i < ccInputs.length; i++) {
    const input = ccInputs[i];
    const lon = (i / Math.max(ccInputs.length, 1)) * Math.PI * 2 - Math.PI;
    // Slight latitude variation so they're not all on the equator
    const lat = ((simpleHash(input.id) % 60) - 30) * (Math.PI / 180);
    const pos = sphereToCartesian(lat, lon, CC_RADIUS);
    const scale = MAX_VISIBLE_SCALE * CC_SCALE_FACTOR;
    const node: ConstellationNode3D = { ...input, position: pos, scale };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // SPOs — positioned on the surface for now, arcs computed as edges
  const spoNodes: ConstellationNode3D[] = [];
  for (let i = 0; i < spoInputs.length; i++) {
    const input = spoInputs[i];
    const hash = simpleHash(input.id);
    const lon = (i / spoInputs.length) * Math.PI * 2 - Math.PI;
    const lat = (((hash % 140) - 70) / 70) * (Math.PI / 2) * 0.85; // spread across latitudes
    const pos = sphereToCartesian(lat, lon, GLOBE_RADIUS);
    const scale =
      (MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE)) *
      SPO_SCALE_FACTOR;
    const node: ConstellationNode3D = { ...input, position: pos, scale };
    spoNodes.push(node);
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  const edges = computeGlobeEdges(nodes, spoNodes);
  return { nodes, edges, nodeMap };
}

/**
 * Map alignment scores to longitude/latitude on the globe.
 * - Dominant dimension → base longitude sector
 * - Weighted average of all dimensions → fine-tuned longitude
 * - Specialization strength → latitude (generalists near equator, specialists toward poles)
 */
function computeSpherePosition(input: LayoutInput): [number, number] {
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
 * Compute edges for the globe visualization.
 * SPO nodes become infrastructure arcs — great circle segments connecting nearby DRep/CC nodes.
 */
function computeGlobeEdges(
  allNodes: ConstellationNode3D[],
  spoNodes: ConstellationNode3D[],
): ConstellationEdge3D[] {
  const edges: ConstellationEdge3D[] = [];
  const drepNodes = allNodes.filter((n) => n.nodeType === 'drep');

  // Proximity edges among DReps in the same dimension (surface connections)
  const maxProximity = 200;
  for (let i = 0; i < drepNodes.length && edges.length < maxProximity; i++) {
    for (let j = i + 1; j < drepNodes.length && edges.length < maxProximity; j++) {
      const a = drepNodes[i];
      const b = drepNodes[j];
      if (a.dominant !== b.dominant) continue;
      if (dist3D(a.position, b.position) > 3) continue;
      edges.push({ from: a.position, to: b.position });
    }
  }

  // SPO infrastructure arcs — each SPO connects to its 2 nearest DRep nodes
  const maxSpoEdges = 300;
  for (const spo of spoNodes) {
    if (edges.length >= maxProximity + maxSpoEdges) break;
    const nearest = drepNodes
      .map((n) => ({ node: n, dist: dist3D(spo.position, n.position) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);

    for (const { node } of nearest) {
      // Create a great-circle arc as a series of segments
      const arcPoints = greatCircleArc(spo.position, node.position, SPO_ARC_RADIUS, 8);
      for (let i = 0; i < arcPoints.length - 1; i++) {
        edges.push({ from: arcPoints[i], to: arcPoints[i + 1] });
      }
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

function sphereToCartesian(lat: number, lon: number, radius: number): [number, number, number] {
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

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
