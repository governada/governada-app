import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({}),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { computePCA } from '@/lib/alignment/pca';
import { imputeMatrix } from '@/lib/alignment/voteMatrix';
import { makeKnownPCAMatrix, makeClassification } from '../fixtures/alignment';

describe('computePCA', () => {
  // ── Known vote matrix → known principal components ──

  it('separates two clearly distinct voting blocs', () => {
    const { rawMatrix, drepIds, proposalIds, classifications } = makeKnownPCAMatrix();

    // 4 DReps × 4 proposals: A,B vote opposite to C,D
    // PC1 should separate [A,B] from [C,D]
    const result = computePCA(rawMatrix, drepIds, proposalIds, classifications);

    expect(result).not.toBeNull();
    if (!result) return;

    // Verify we got coordinates for all DReps
    expect(result.coordinates.size).toBe(4);

    // PC1 should clearly separate the two groups
    const coordA = result.coordinates.get('drepA')!;
    const coordB = result.coordinates.get('drepB')!;
    const coordC = result.coordinates.get('drepC')!;
    const coordD = result.coordinates.get('drepD')!;

    // A and B should have similar PC1 coordinates (same voting pattern)
    expect(Math.abs(coordA[0] - coordB[0])).toBeLessThan(0.01);

    // C and D should have similar PC1 coordinates (same voting pattern)
    expect(Math.abs(coordC[0] - coordD[0])).toBeLessThan(0.01);

    // The two groups should be on opposite sides of PC1
    // (A,B) should have opposite sign from (C,D) on PC1
    expect(Math.sign(coordA[0])).toBe(-Math.sign(coordC[0]));
  });

  // ── Explained variance sums correctly ──

  it('explained variance components sum to totalExplainedVariance', () => {
    const { rawMatrix, drepIds, proposalIds, classifications } = makeKnownPCAMatrix();
    const result = computePCA(rawMatrix, drepIds, proposalIds, classifications);

    expect(result).not.toBeNull();
    if (!result) return;

    const sum = result.explainedVariance.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(result.totalExplainedVariance, 5);
  });

  it('explained variance is between 0 and 1 for each component', () => {
    const { rawMatrix, drepIds, proposalIds, classifications } = makeKnownPCAMatrix();
    const result = computePCA(rawMatrix, drepIds, proposalIds, classifications);

    expect(result).not.toBeNull();
    if (!result) return;

    for (const ev of result.explainedVariance) {
      expect(ev).toBeGreaterThanOrEqual(0);
      expect(ev).toBeLessThanOrEqual(1);
    }
  });

  // ── Edge: Matrix too small ──

  it('returns null for matrix smaller than 3×3', () => {
    // 2 DReps × 2 proposals
    const result = computePCA(
      [
        [1, -1],
        [-1, 1],
      ],
      ['d1', 'd2'],
      ['p1', 'p2'],
      [
        makeClassification({ proposalTxHash: 'p1', proposalIndex: 0 }),
        makeClassification({ proposalTxHash: 'p2', proposalIndex: 0 }),
      ],
    );
    expect(result).toBeNull();
  });

  it('returns null for single DRep (1 row)', () => {
    const result = computePCA([[1, -1, 0]], ['d1'], ['p1-0', 'p2-0', 'p3-0'], []);
    expect(result).toBeNull();
  });

  it('returns null for single proposal (1 column)', () => {
    const result = computePCA([[1], [-1], [0]], ['d1', 'd2', 'd3'], ['p1-0'], []);
    expect(result).toBeNull();
  });

  // ── Number of components respects matrix dimensions ──

  it('limits components to min(rows-1, cols-1)', () => {
    // 4×4 matrix → max 3 components
    const { rawMatrix, drepIds, proposalIds, classifications } = makeKnownPCAMatrix();
    const result = computePCA(rawMatrix, drepIds, proposalIds, classifications, {
      components: 10,
    });

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.explainedVariance.length).toBeLessThanOrEqual(3);
  });

  // ── Loadings dimensions ──

  it('produces loadings with correct dimensions (k × m)', () => {
    const { rawMatrix, drepIds, proposalIds, classifications } = makeKnownPCAMatrix();
    const result = computePCA(rawMatrix, drepIds, proposalIds, classifications);

    expect(result).not.toBeNull();
    if (!result) return;

    const k = result.loadings.length; // number of components
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThanOrEqual(3); // min(4-1, 4-1) = 3

    // Each loading vector should have length = number of proposals
    for (const loading of result.loadings) {
      expect(loading.length).toBe(proposalIds.length);
    }
  });

  // ── Component labels generated ──

  it('generates component labels', () => {
    const { rawMatrix, drepIds, proposalIds, classifications } = makeKnownPCAMatrix();
    const result = computePCA(rawMatrix, drepIds, proposalIds, classifications);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.componentLabels.length).toBe(result.loadings.length);
    for (const label of result.componentLabels) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  // ── Handles NaN in matrix (imputation) ──

  it('handles NaN values via mean imputation before PCA', () => {
    const matrix = [
      [1, NaN, -1],
      [-1, 1, NaN],
      [NaN, -1, 1],
    ];

    const result = computePCA(
      matrix,
      ['d1', 'd2', 'd3'],
      ['p1-0', 'p2-0', 'p3-0'],
      [
        makeClassification({ proposalTxHash: 'p1', proposalIndex: 0 }),
        makeClassification({ proposalTxHash: 'p2', proposalIndex: 0 }),
        makeClassification({ proposalTxHash: 'p3', proposalIndex: 0 }),
      ],
    );

    // Should succeed despite NaN values
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.coordinates.size).toBe(3);
  });

  // ── runId is unique ──

  it('generates unique runId', () => {
    const { rawMatrix, drepIds, proposalIds, classifications } = makeKnownPCAMatrix();
    const r1 = computePCA(rawMatrix, drepIds, proposalIds, classifications);
    const r2 = computePCA(rawMatrix, drepIds, proposalIds, classifications);
    expect(r1!.runId).not.toBe(r2!.runId);
  });
});

describe('imputeMatrix', () => {
  it('returns empty array for empty input', () => {
    expect(imputeMatrix([])).toEqual([]);
  });

  it('replaces NaN with column mean', () => {
    const input = [
      [1, 2, NaN],
      [3, NaN, 6],
      [5, 4, 9],
    ];
    const result = imputeMatrix(input);

    // Column 0: mean(1,3,5) = 3 → no NaN
    // Column 1: mean(2,4) = 3 → NaN replaced with 3
    // Column 2: mean(6,9) = 7.5 → NaN replaced with 7.5
    expect(result[0][2]).toBe(7.5);
    expect(result[1][1]).toBe(3);
  });

  it('replaces NaN with 0 when entire column is NaN', () => {
    const input = [
      [1, NaN],
      [2, NaN],
    ];
    const result = imputeMatrix(input);
    expect(result[0][1]).toBe(0);
    expect(result[1][1]).toBe(0);
  });

  it('does not modify non-NaN values', () => {
    const input = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const result = imputeMatrix(input);
    expect(result).toEqual(input);
  });
});
