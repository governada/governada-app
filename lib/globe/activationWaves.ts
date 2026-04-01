/**
 * Activation wave direction control.
 *
 * Computes per-node activation delays for different sweep directions.
 * 'radial' = from origin outward (existing behavior).
 * 'left-right' = sort by X coordinate.
 * 'top-bottom' = sort by Y coordinate.
 * 'from-node' = distance from a specific source node.
 */

import type { ActivationDirection } from './types';
import type { ConstellationNode3D } from '@/lib/constellation/types';

export function computeDirectionalDelays(
  nodes: ConstellationNode3D[],
  focusedIds: Set<string>,
  direction: ActivationDirection,
  sourceNodeId?: string | null,
  duration = 0.6,
): Map<string, number> {
  const delays = new Map<string, number>();
  if (focusedIds.size === 0) return delays;

  // Find source node for 'from-node' direction
  let sourcePos: [number, number, number] = [0, 0, 0];
  if (direction === 'from-node' && sourceNodeId) {
    const sourceNode = nodes.find((n) => n.id === sourceNodeId);
    if (sourceNode) sourcePos = sourceNode.position;
  }

  // Compute raw value per node based on direction
  const values: Array<{ id: string; value: number }> = [];
  for (const node of nodes) {
    let value: number;
    switch (direction) {
      case 'left-right':
        value = node.position[0];
        break;
      case 'top-bottom':
        value = -node.position[1]; // top = highest Y = earliest
        break;
      case 'from-node': {
        const dx = node.position[0] - sourcePos[0];
        const dy = node.position[1] - sourcePos[1];
        const dz = node.position[2] - sourcePos[2];
        value = Math.sqrt(dx * dx + dy * dy + dz * dz);
        break;
      }
      case 'radial':
      default: {
        const [x, y, z] = node.position;
        value = Math.sqrt(x * x + y * y + z * z);
        break;
      }
    }
    values.push({ id: node.id, value });
  }

  // Normalize to [0, duration]
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const { value } of values) {
    if (value < minVal) minVal = value;
    if (value > maxVal) maxVal = value;
  }
  const range = maxVal - minVal || 1;

  for (const { id, value } of values) {
    delays.set(id, ((value - minVal) / range) * duration);
  }

  return delays;
}
