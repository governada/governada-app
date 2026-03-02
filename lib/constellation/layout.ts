/**
 * 6-arm radial layout inspired by the Cardano logo topology.
 * Outputs 3D positions for React Three Fiber rendering.
 *
 * Structure (inside-out):
 *   Core (origin) -> 6 anchor nodes (inner hexagonal ring) -> DRep nodes (arm clusters)
 * Arm pitch alternates ±15° so auto-rotation reveals real 3D depth.
 */

import type { ConstellationNode3D, ConstellationEdge3D, LayoutResult } from './types';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { getDimensionOrder } from '@/lib/drepIdentity';

const DIMS = getDimensionOrder();

const ARM_ANGLES: Record<AlignmentDimension, number> = (() => {
  const map: Record<string, number> = {};
  DIMS.forEach((dim, i) => {
    map[dim] = (i / DIMS.length) * Math.PI * 2 - Math.PI / 2;
  });
  return map as Record<AlignmentDimension, number>;
})();

const ARM_PITCH = [0.26, -0.26, 0.26, -0.26, 0.26, -0.26]; // ~15° alternating tilt
const ARM_FAN_ARC = Math.PI / 3;
const MAX_RADIUS = 12;
const ANCHOR_RADIUS = MAX_RADIUS * 0.3;
const MIN_VISIBLE_SCALE = 0.06;
const MAX_VISIBLE_SCALE = 0.25;

interface LayoutInput {
  id: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
}

export function computeLayout(
  inputs: LayoutInput[],
  nodeLimit: number
): LayoutResult {
  const sorted = [...inputs].sort((a, b) => b.power - a.power);
  const active = sorted.slice(0, nodeLimit);

  const nodes: ConstellationNode3D[] = [];
  const nodeMap = new Map<string, ConstellationNode3D>();

  // H2: Generate 6 anchor nodes forming inner hexagonal ring
  const anchorNodes: ConstellationNode3D[] = [];
  for (let i = 0; i < DIMS.length; i++) {
    const dim = DIMS[i];
    const angle = ARM_ANGLES[dim];
    const pitch = ARM_PITCH[i];
    const x = Math.cos(angle) * ANCHOR_RADIUS;
    const y = Math.sin(angle) * ANCHOR_RADIUS;
    const z = Math.sin(pitch) * ANCHOR_RADIUS;

    const anchor: ConstellationNode3D = {
      id: `__anchor_${dim}__`,
      name: dim,
      power: 1,
      score: 50,
      dominant: dim,
      alignments: [50, 50, 50, 50, 50, 50],
      position: [x, y, z],
      scale: MAX_VISIBLE_SCALE * 1.2,
      isAnchor: true,
    };
    anchorNodes.push(anchor);
    nodes.push(anchor);
    nodeMap.set(anchor.id, anchor);
  }

  for (const input of active) {
    const pos = computeNodePosition(input);
    const scale = MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE);
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  rebalanceAngular(nodes);
  repulse(nodes);

  const edges = computeEdges(nodes, anchorNodes);
  return { nodes, edges, nodeMap };
}

function computeNodePosition(input: LayoutInput): [number, number, number] {
  const scores = input.alignments;

  let wx = 0, wy = 0, totalWeight = 0;
  for (let i = 0; i < DIMS.length; i++) {
    const score = scores[i] ?? 50;
    const weight = Math.abs(score - 50);
    const angle = ARM_ANGLES[DIMS[i]];
    wx += Math.cos(angle) * weight;
    wy += Math.sin(angle) * weight;
    totalWeight += weight;
  }

  const hash = simpleHash(input.id);
  const hashNorm = (hash % 10000) / 10000;

  if (totalWeight < 1) {
    const hashAngle = ((hash >> 8) % 10000) / 10000;
    const r = 0.8 + hashNorm * 1.8;
    const a = hashAngle * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, (hashAngle - 0.5) * 2.5];
  }

  const dirAngle = Math.atan2(wy, wx);
  const specialization = Math.min(1, totalWeight / (DIMS.length * 30));

  // H4: Arm-tip clustering — push nodes toward outer 60-80% of arm
  const clustered = Math.pow(specialization, 0.7);
  const dist = MAX_RADIUS * (0.1 + clustered * 0.85);

  const fanOffset = (hashNorm - 0.5) * ARM_FAN_ARC;
  const finalAngle = dirAngle + fanOffset;

  const radialJitter = (((hash >> 8) % 1000) / 1000 - 0.5) * MAX_RADIUS * 0.15;

  const x = Math.cos(finalAngle) * (dist + radialJitter);
  const y = Math.sin(finalAngle) * (dist + radialJitter);

  // H1: Widened z-spread + arm pitch for real 3D depth
  const armIndex = DIMS.indexOf(input.dominant);
  const pitch = ARM_PITCH[armIndex >= 0 ? armIndex : 0];
  const z = Math.sin(pitch) * dist + (input.score / 100 - 0.5) * 6 + (hashNorm - 0.5) * 3;

  return [x, y, z];
}

function computeEdges(
  nodes: ConstellationNode3D[],
  anchorNodes: ConstellationNode3D[]
): ConstellationEdge3D[] {
  const edges: ConstellationEdge3D[] = [];

  // Anchor ring — connect each anchor to its neighbors (hexagonal ring)
  for (let i = 0; i < anchorNodes.length; i++) {
    const next = anchorNodes[(i + 1) % anchorNodes.length];
    edges.push({ from: anchorNodes[i].position, to: next.position });
  }

  // H2: Connect each anchor to its 3 nearest real (non-anchor) nodes in its arm
  const realNodes = nodes.filter(n => !n.isAnchor);
  for (const anchor of anchorNodes) {
    const sameArm = realNodes
      .filter(n => n.dominant === anchor.dominant)
      .map(n => ({ node: n, dist: dist3D(anchor.position, n.position) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
    for (const { node } of sameArm) {
      edges.push({ from: anchor.position, to: node.position });
    }
  }

  // Proximity edges within same dimension
  const maxEdges = 300;
  for (let i = 0; i < realNodes.length && edges.length < maxEdges; i++) {
    for (let j = i + 1; j < realNodes.length && edges.length < maxEdges; j++) {
      const a = realNodes[i];
      const b = realNodes[j];
      if (a.dominant !== b.dominant) continue;
      if (dist3D(a.position, b.position) > 4) continue;
      edges.push({ from: a.position, to: b.position });
    }
  }

  return edges;
}

function dist3D(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function rebalanceAngular(nodes: ConstellationNode3D[]): void {
  const realNodes = nodes.filter(n => !n.isAnchor);
  if (realNodes.length < 2) return;

  const NUM_SECTORS = 12;
  const sectorArc = (Math.PI * 2) / NUM_SECTORS;

  const sectors: ConstellationNode3D[][] = Array.from({ length: NUM_SECTORS }, () => []);
  for (const node of realNodes) {
    let angle = Math.atan2(node.position[1], node.position[0]);
    if (angle < 0) angle += Math.PI * 2;
    const sector = Math.min(NUM_SECTORS - 1, Math.floor(angle / sectorArc));
    sectors[sector].push(node);
  }

  const avgPerSector = realNodes.length / NUM_SECTORS;
  const cap = Math.ceil(avgPerSector * 1.8);

  for (let s = 0; s < NUM_SECTORS; s++) {
    if (sectors[s].length <= cap) continue;

    sectors[s].sort((a, b) => {
      const dA = a.position[0] ** 2 + a.position[1] ** 2;
      const dB = b.position[0] ** 2 + b.position[1] ** 2;
      return dB - dA;
    });

    const overflow = sectors[s].length - cap;
    for (let i = 0; i < overflow; i++) {
      const node = sectors[s][i];
      const left = (s - 1 + NUM_SECTORS) % NUM_SECTORS;
      const right = (s + 1) % NUM_SECTORS;
      const target = sectors[left].length <= sectors[right].length ? left : right;

      const currentAngle = Math.atan2(node.position[1], node.position[0]);
      const targetCenter = (target + 0.5) * sectorArc;

      let delta = targetCenter - currentAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;

      const shift = delta * 0.4;
      const r = Math.sqrt(node.position[0] ** 2 + node.position[1] ** 2);
      const newAngle = currentAngle + shift;

      node.position[0] = Math.cos(newAngle) * r;
      node.position[1] = Math.sin(newAngle) * r;

      sectors[target].push(node);
    }
    sectors[s].splice(0, overflow);
  }
}

function repulse(nodes: ConstellationNode3D[]): void {
  const realNodes = nodes.filter(n => !n.isAnchor);
  const MIN_DIST = 0.8;
  const STRENGTH = 0.4;

  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < realNodes.length; i++) {
      for (let j = i + 1; j < realNodes.length; j++) {
        const a = realNodes[i].position;
        const b = realNodes[j].position;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < MIN_DIST * MIN_DIST && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const force = (MIN_DIST - dist) / dist * STRENGTH;
          a[0] -= dx * force;
          a[1] -= dy * force;
          a[2] -= dz * force;
          b[0] += dx * force;
          b[1] += dy * force;
          b[2] += dz * force;
        }
      }
    }
  }
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
