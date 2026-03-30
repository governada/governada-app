import { describe, it, expect } from 'vitest';

import { detectClusters, computeSilhouetteScore } from '@/lib/globe/clusterDetection';
import type { LayoutInput } from '@/lib/constellation/globe-layout';

function makeInput(
  id: string,
  alignments: number[],
  overrides?: Partial<LayoutInput>,
): LayoutInput {
  return {
    id,
    fullId: id,
    name: null,
    power: 0.5,
    score: 50,
    dominant: 'innovation',
    alignments,
    nodeType: 'drep',
    ...overrides,
  };
}

describe('detectClusters', () => {
  it('returns empty for too few inputs', () => {
    const result = detectClusters([makeInput('a', [80, 20, 50, 50, 50, 50])]);
    expect(result.clusters).toHaveLength(0);
    expect(result.k).toBe(0);
  });

  it('detects distinct clusters from well-separated data', () => {
    // Create 3 tight groups of 10 nodes each in different alignment dimensions
    const inputs: LayoutInput[] = [];

    // Group A: treasury conservative (high dim 0)
    for (let i = 0; i < 10; i++) {
      inputs.push(makeInput(`a-${i}`, [85 + i * 0.5, 20, 50, 50, 50, 50]));
    }

    // Group B: innovation-focused (high dim 4)
    for (let i = 0; i < 10; i++) {
      inputs.push(makeInput(`b-${i}`, [50, 50, 50, 50, 85 + i * 0.5, 50]));
    }

    // Group C: security-focused (high dim 3)
    for (let i = 0; i < 10; i++) {
      inputs.push(makeInput(`c-${i}`, [50, 50, 50, 85 + i * 0.5, 50, 50]));
    }

    // Group D: decentralization (high dim 2)
    for (let i = 0; i < 10; i++) {
      inputs.push(makeInput(`d-${i}`, [50, 50, 85 + i * 0.5, 50, 50, 50]));
    }

    // Group E: transparency (high dim 5)
    for (let i = 0; i < 10; i++) {
      inputs.push(makeInput(`e-${i}`, [50, 50, 50, 50, 50, 85 + i * 0.5]));
    }

    const result = detectClusters(inputs, { minK: 5, maxK: 5 });

    expect(result.clusters.length).toBe(5);
    expect(result.silhouetteScore).toBeGreaterThan(0.25);

    // Each cluster should have ~10 members
    for (const cluster of result.clusters) {
      expect(cluster.memberCount).toBeGreaterThanOrEqual(5);
      expect(cluster.memberIds.length).toBe(cluster.memberCount);
    }
  });

  it('produces clusters with valid sphere positions', () => {
    const inputs: LayoutInput[] = [];
    for (let i = 0; i < 30; i++) {
      const dim = i % 6;
      const aligns = [50, 50, 50, 50, 50, 50];
      aligns[dim] = 80 + (i % 5);
      inputs.push(makeInput(`n-${i}`, aligns));
    }

    const result = detectClusters(inputs, { minK: 5, maxK: 6 });

    for (const cluster of result.clusters) {
      // centroid6D should have 6 values
      expect(cluster.centroid6D).toHaveLength(6);

      // centroidSphere should be [lon, lat]
      expect(cluster.centroidSphere).toHaveLength(2);
      const [lon, lat] = cluster.centroidSphere;
      expect(lon).toBeGreaterThanOrEqual(-Math.PI - 0.01);
      expect(lon).toBeLessThanOrEqual(Math.PI + 0.01);
      expect(lat).toBeGreaterThanOrEqual(-Math.PI / 2 - 0.01);
      expect(lat).toBeLessThanOrEqual(Math.PI / 2 + 0.01);

      // centroid3D should be a valid 3D position
      expect(cluster.centroid3D).toHaveLength(3);
      const [x, y, z] = cluster.centroid3D;
      const r = Math.sqrt(x * x + y * y + z * z);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(10); // within globe bounds
    }
  });

  it('assigns a dominant dimension to each cluster', () => {
    const inputs: LayoutInput[] = [];
    for (let i = 0; i < 25; i++) {
      const dim = i % 5;
      const aligns = [50, 50, 50, 50, 50, 50];
      aligns[dim] = 90;
      inputs.push(makeInput(`n-${i}`, aligns));
    }

    const result = detectClusters(inputs, { minK: 5, maxK: 5 });

    for (const cluster of result.clusters) {
      expect(cluster.dominantDimension).toBeTruthy();
      expect([
        'treasuryConservative',
        'treasuryGrowth',
        'decentralization',
        'security',
        'innovation',
        'transparency',
      ]).toContain(cluster.dominantDimension);
    }
  });

  it('filters out nodes with all-neutral alignments', () => {
    const inputs: LayoutInput[] = [
      // 10 meaningful nodes
      ...Array.from({ length: 10 }, (_, i) => makeInput(`real-${i}`, [80, 20, 50, 50, 50, 50])),
      // 5 all-neutral nodes (should be filtered)
      ...Array.from({ length: 5 }, (_, i) => makeInput(`neutral-${i}`, [50, 50, 50, 50, 50, 50])),
    ];

    const result = detectClusters(inputs, { minK: 5, maxK: 5 });
    // Neutral nodes should not appear in any cluster
    for (const cluster of result.clusters) {
      for (const id of cluster.memberIds) {
        expect(id).not.toMatch(/^neutral-/);
      }
    }
  });
});

describe('computeSilhouetteScore', () => {
  it('returns 0 for single cluster', () => {
    const points = [
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    const assignments = [0, 0, 0];
    expect(computeSilhouetteScore(points, assignments, 1)).toBe(0);
  });

  it('returns high score for well-separated clusters', () => {
    const points = [
      [0, 0],
      [1, 0],
      [2, 0], // cluster 0
      [100, 0],
      [101, 0],
      [102, 0], // cluster 1
    ];
    const assignments = [0, 0, 0, 1, 1, 1];
    const score = computeSilhouetteScore(points, assignments, 2);
    expect(score).toBeGreaterThan(0.9);
  });

  it('returns low score for overlapping clusters', () => {
    const points = [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    const assignments = [0, 0, 0, 1, 1, 1];
    const score = computeSilhouetteScore(points, assignments, 2);
    expect(score).toBeLessThan(0.5);
  });
});
