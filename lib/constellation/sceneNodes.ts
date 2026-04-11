import { computeGlobeLayout, type LayoutInput } from '@/lib/constellation/globe-layout';
import type { ConstellationNode3D, GovernanceNodeType } from '@/lib/constellation/types';

export const CONSTELLATION_NODE_LIMITS = {
  low: 200,
  mid: 500,
  high: 800,
} as const;

export type ConstellationSceneQuality = keyof typeof CONSTELLATION_NODE_LIMITS;

function isDrepNode(node: { nodeType: GovernanceNodeType }): boolean {
  return node.nodeType === 'drep';
}

export function buildPrecomputedConstellationNodes(inputs: LayoutInput[]): ConstellationNode3D[] {
  return computeGlobeLayout(inputs, CONSTELLATION_NODE_LIMITS.high).nodes;
}

export function hasPrecomputedConstellationNodes(
  nodes: Array<LayoutInput | ConstellationNode3D>,
): nodes is ConstellationNode3D[] {
  return nodes.every((node) => {
    const candidate = node as Partial<ConstellationNode3D>;
    return Array.isArray(candidate.position) && typeof candidate.scale === 'number';
  });
}

export function limitPrecomputedConstellationNodes(
  nodes: ConstellationNode3D[],
  quality: ConstellationSceneQuality,
): ConstellationNode3D[] {
  const drepLimit = CONSTELLATION_NODE_LIMITS[quality];
  const drepNodes = nodes.filter(isDrepNode).sort((left, right) => right.power - left.power);
  const otherNodes = nodes.filter((node) => !isDrepNode(node));

  return [...drepNodes.slice(0, drepLimit), ...otherNodes];
}
