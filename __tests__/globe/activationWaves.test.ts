import { describe, it, expect } from 'vitest';
import { computeDirectionalDelays } from '@/lib/globe/activationWaves';
import type { ConstellationNode3D } from '@/lib/constellation/types';

function makeNode(id: string, position: [number, number, number]): ConstellationNode3D {
  return {
    id,
    fullId: id,
    name: id,
    power: 0,
    score: 50,
    dominant: 'transparency',
    alignments: [50, 50, 50, 50, 50, 50],
    position,
    scale: 0.08,
    nodeType: 'drep',
  };
}

const testNodes = [
  makeNode('a', [-5, 0, 0]), // far left
  makeNode('b', [0, 5, 0]), // top
  makeNode('c', [5, 0, 0]), // far right
  makeNode('d', [0, -5, 0]), // bottom
  makeNode('e', [0, 0, 0]), // origin
];

const allIds = new Set(testNodes.map((n) => n.id));

describe('computeDirectionalDelays', () => {
  it('radial: origin node has smallest delay', () => {
    const delays = computeDirectionalDelays(testNodes, allIds, 'radial', null, 1.0);
    expect(delays.get('e')).toBe(0); // origin = closest to center
    expect(delays.get('a')!).toBeGreaterThan(0);
  });

  it('left-right: leftmost has smallest delay', () => {
    const delays = computeDirectionalDelays(testNodes, allIds, 'left-right', null, 1.0);
    expect(delays.get('a')).toBe(0); // x=-5 is leftmost
    expect(delays.get('c')).toBeCloseTo(1.0, 2); // x=5 is rightmost = max delay
  });

  it('top-bottom: topmost has smallest delay', () => {
    const delays = computeDirectionalDelays(testNodes, allIds, 'top-bottom', null, 1.0);
    expect(delays.get('b')).toBe(0); // y=5 is top (negated = smallest)
    expect(delays.get('d')).toBeCloseTo(1.0, 2); // y=-5 is bottom = max delay
  });

  it('from-node: source node has delay 0', () => {
    const delays = computeDirectionalDelays(testNodes, allIds, 'from-node', 'a', 1.0);
    expect(delays.get('a')).toBe(0); // source node
    expect(delays.get('c')!).toBeGreaterThan(delays.get('e')!); // further from source
  });

  it('respects duration parameter', () => {
    const delays = computeDirectionalDelays(testNodes, allIds, 'radial', null, 0.5);
    for (const [, delay] of delays) {
      expect(delay).toBeLessThanOrEqual(0.5);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns empty map for empty focusedIds', () => {
    const delays = computeDirectionalDelays(testNodes, new Set(), 'radial');
    expect(delays.size).toBe(0);
  });

  it('produces delays for all nodes (not just focused)', () => {
    const delays = computeDirectionalDelays(testNodes, allIds, 'radial');
    expect(delays.size).toBe(testNodes.length);
  });
});
