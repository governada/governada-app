import { describe, expect, it } from 'vitest';
import {
  buildPrecomputedConstellationNodes,
  hasPrecomputedConstellationNodes,
  limitPrecomputedConstellationNodes,
} from '@/lib/constellation/sceneNodes';
import type { LayoutInput } from '@/lib/constellation/globe-layout';

function makeDrep(id: string, power: number): LayoutInput {
  return {
    id,
    fullId: id,
    name: id,
    power,
    score: 50 + power * 10,
    dominant: 'transparency',
    alignments: [50, 50, 50, 50, 50, 70],
    nodeType: 'drep',
  };
}

describe('constellation scene nodes', () => {
  it('builds precomputed nodes with 3D positions and scales', () => {
    const nodes = buildPrecomputedConstellationNodes([
      makeDrep('drep-a', 0.9),
      {
        id: 'cc-a',
        fullId: 'cc-a',
        name: 'cc-a',
        power: 0.8,
        score: 75,
        dominant: 'transparency',
        alignments: [50, 50, 50, 50, 50, 60],
        nodeType: 'cc',
      },
    ]);

    expect(hasPrecomputedConstellationNodes(nodes)).toBe(true);
    expect(nodes[0].position).toHaveLength(3);
    expect(nodes[0].scale).toBeGreaterThan(0);
  });

  it('limits only DRep nodes by quality tier and keeps non-DRep nodes', () => {
    const precomputed = buildPrecomputedConstellationNodes([
      ...Array.from({ length: 205 }, (_, index) => makeDrep(`drep-${index}`, 1 - index / 1000)),
      {
        id: 'spo-a',
        fullId: 'spo-a',
        name: 'spo-a',
        power: 0.5,
        score: 60,
        dominant: 'innovation',
        alignments: [50, 50, 50, 50, 65, 50],
        nodeType: 'spo',
      },
      {
        id: 'cc-a',
        fullId: 'cc-a',
        name: 'cc-a',
        power: 0.8,
        score: 75,
        dominant: 'transparency',
        alignments: [50, 50, 50, 50, 50, 60],
        nodeType: 'cc',
      },
    ]);

    const lowNodes = limitPrecomputedConstellationNodes(precomputed, 'low');

    expect(lowNodes.filter((node) => node.nodeType === 'drep')).toHaveLength(200);
    expect(lowNodes.some((node) => node.nodeType === 'spo')).toBe(true);
    expect(lowNodes.some((node) => node.nodeType === 'cc')).toBe(true);
  });
});
