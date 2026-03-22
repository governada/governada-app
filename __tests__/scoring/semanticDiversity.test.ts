import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  computeSemanticDiversityScore,
  computeSemanticDiversityMap,
} from '@/lib/scoring/semanticDiversity';

// ── cosineSimilarity ──

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('returns 0 for zero vector', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('handles high-dimensional vectors (3072-dim)', () => {
    // Simulate embeddings with known similarity
    const a = Array.from({ length: 3072 }, (_, i) => Math.sin(i * 0.1));
    const b = Array.from({ length: 3072 }, (_, i) => Math.sin(i * 0.1 + 0.01)); // slight shift
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.99); // very similar
    expect(sim).toBeLessThanOrEqual(1);
  });
});

// ── computeSemanticDiversityScore ──

describe('computeSemanticDiversityScore', () => {
  it('returns null for fewer than 3 embeddings', () => {
    expect(computeSemanticDiversityScore([])).toBeNull();
    expect(
      computeSemanticDiversityScore([
        [1, 0],
        [0, 1],
      ]),
    ).toBeNull();
  });

  it('returns high diversity for orthogonal embeddings', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const score = computeSemanticDiversityScore(embeddings)!;
    // All pairs have cosine similarity 0 → diversity = 100
    expect(score).toBe(100);
  });

  it('returns low diversity for near-identical embeddings', () => {
    const base = [1, 2, 3, 4, 5];
    const embeddings = [
      base,
      base.map((x) => x + 0.001), // tiny perturbation
      base.map((x) => x + 0.002),
    ];
    const score = computeSemanticDiversityScore(embeddings)!;
    // All pairs nearly identical → diversity close to 0
    expect(score).toBeLessThan(5);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns moderate diversity for mixed embeddings', () => {
    const embeddings = [
      [1, 0, 0, 0],
      [1, 0, 0, 0], // duplicate of first
      [0, 1, 0, 0], // orthogonal
      [0, 0, 1, 0], // orthogonal
    ];
    const score = computeSemanticDiversityScore(embeddings)!;
    // Some pairs identical (sim=1), some orthogonal (sim=0)
    // 6 pairs: (0,1)=1, (0,2)=0, (0,3)=0, (1,2)=0, (1,3)=0, (2,3)=0
    // avg = 1/6 ≈ 0.167, diversity = (1 - 0.167) * 100 ≈ 83.3
    expect(score).toBeCloseTo(83.33, 0);
  });

  it('clamps negative similarity to 0 minimum diversity', () => {
    // All pairs have negative cosine similarity → (1 - negative) > 100
    // But we clamp to 100
    const embeddings = [
      [1, -1, 0],
      [-1, 1, 0],
      [0, 0, -1],
    ];
    const score = computeSemanticDiversityScore(embeddings)!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles zero vectors gracefully', () => {
    const embeddings = [
      [0, 0, 0],
      [1, 2, 3],
      [4, 5, 6],
    ];
    const score = computeSemanticDiversityScore(embeddings);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
    expect(score!).toBeLessThanOrEqual(100);
  });
});

// ── computeSemanticDiversityMap ──

describe('computeSemanticDiversityMap', () => {
  it('returns empty map for empty input', () => {
    const result = computeSemanticDiversityMap(new Map());
    expect(result.size).toBe(0);
  });

  it('omits DReps with fewer than 3 embeddings', () => {
    const input = new Map<string, number[][]>([
      [
        'drep_few',
        [
          [1, 0],
          [0, 1],
        ],
      ], // only 2
      [
        'drep_enough',
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
      ], // 3
    ]);
    const result = computeSemanticDiversityMap(input);
    expect(result.has('drep_few')).toBe(false);
    expect(result.has('drep_enough')).toBe(true);
  });

  it('computes scores for multiple DReps independently', () => {
    const diverse = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]; // orthogonal
    const copyPaste = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]; // identical

    const input = new Map<string, number[][]>([
      ['drep_diverse', diverse],
      ['drep_copypaste', copyPaste],
    ]);

    const result = computeSemanticDiversityMap(input);
    expect(result.get('drep_diverse')!).toBeGreaterThan(result.get('drep_copypaste')!);
    expect(result.get('drep_diverse')).toBe(100);
    expect(result.get('drep_copypaste')).toBe(0);
  });
});
