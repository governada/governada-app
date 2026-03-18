import { describe, test, expect } from 'vitest';
import {
  computeAiInfluence,
  computeOriginality,
  computeReviewRelevance,
  computeReviewOriginality,
  computeReviewDiversity,
  detectHomogenization,
} from '@/lib/workspace/aiQuality';

describe('computeAiInfluence', () => {
  test('identical vectors (no change) return 0', () => {
    const v = [1, 0, 0];
    expect(computeAiInfluence(v, v)).toBeCloseTo(0, 5);
  });

  test('orthogonal vectors (complete rewrite) return 100', () => {
    const pre = [1, 0, 0];
    const post = [0, 1, 0];
    expect(computeAiInfluence(pre, post)).toBeCloseTo(100, 5);
  });

  test('partially similar vectors return middle range', () => {
    const pre = [1, 0, 0];
    const post = [1, 1, 0]; // cos_sim = 1/sqrt(2) ~= 0.707
    const influence = computeAiInfluence(pre, post);
    expect(influence).toBeGreaterThan(20);
    expect(influence).toBeLessThan(50);
  });

  test('nearly identical vectors return low influence', () => {
    const pre = [1, 0, 0];
    const post = [0.99, 0.01, 0]; // very similar
    const influence = computeAiInfluence(pre, post);
    expect(influence).toBeGreaterThanOrEqual(0);
    expect(influence).toBeLessThan(5);
  });
});

describe('computeOriginality', () => {
  test('unique draft vs no corpus returns 100', () => {
    const draft = [1, 0, 0];
    expect(computeOriginality(draft, [])).toBe(100);
  });

  test('identical copy of existing returns ~0', () => {
    const draft = [1, 0, 0];
    const existing = [[1, 0, 0]];
    expect(computeOriginality(draft, existing)).toBeCloseTo(0, 5);
  });

  test('orthogonal to all existing returns 100', () => {
    const draft = [0, 0, 1];
    const existing = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    expect(computeOriginality(draft, existing)).toBeCloseTo(100, 5);
  });

  test('partially similar returns intermediate score', () => {
    const draft = [1, 1, 0];
    const existing = [[1, 0, 0]]; // cos_sim = 1/sqrt(2) ~= 0.707
    const originality = computeOriginality(draft, existing);
    expect(originality).toBeGreaterThan(20);
    expect(originality).toBeLessThan(50);
  });

  test('most similar match determines score (not average)', () => {
    const draft = [1, 0, 0];
    const existing = [
      [0, 1, 0], // orthogonal
      [0.99, 0.01, 0], // very similar
    ];
    const originality = computeOriginality(draft, existing);
    // Should be low because the second existing is very similar
    expect(originality).toBeLessThan(5);
  });
});

describe('computeReviewRelevance', () => {
  test('on-topic annotation returns high score', () => {
    const annotation = [1, 0, 0];
    const section = [1, 0, 0];
    expect(computeReviewRelevance(annotation, section)).toBeCloseTo(100, 5);
  });

  test('off-topic annotation returns ~0', () => {
    const annotation = [0, 1, 0];
    const section = [1, 0, 0];
    expect(computeReviewRelevance(annotation, section)).toBeCloseTo(0, 5);
  });

  test('partially relevant returns intermediate score', () => {
    const annotation = [1, 1, 0];
    const section = [1, 0, 0];
    const relevance = computeReviewRelevance(annotation, section);
    expect(relevance).toBeGreaterThan(50);
    expect(relevance).toBeLessThan(100);
  });
});

describe('computeReviewOriginality', () => {
  test('paraphrase of section returns ~0', () => {
    const annotation = [1, 0, 0];
    const section = [1, 0, 0];
    expect(computeReviewOriginality(annotation, section)).toBeCloseTo(0, 5);
  });

  test('novel concern returns high score', () => {
    const annotation = [0, 1, 0];
    const section = [1, 0, 0];
    expect(computeReviewOriginality(annotation, section)).toBeCloseTo(100, 5);
  });

  test('partially novel returns intermediate score', () => {
    const annotation = [1, 1, 0];
    const section = [1, 0, 0];
    const originality = computeReviewOriginality(annotation, section);
    expect(originality).toBeGreaterThan(20);
    expect(originality).toBeLessThan(50);
  });
});

describe('computeReviewDiversity', () => {
  test('single annotation returns diversity 0 and cluster count 1', () => {
    const result = computeReviewDiversity([[1, 0, 0]]);
    expect(result.diversityScore).toBe(0);
    expect(result.clusterCount).toBe(1);
  });

  test('empty input returns diversity 0 and cluster count 0', () => {
    const result = computeReviewDiversity([]);
    expect(result.diversityScore).toBe(0);
    expect(result.clusterCount).toBe(0);
  });

  test('identical annotations return diversity 0 and cluster count 1', () => {
    const result = computeReviewDiversity([
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
    ]);
    expect(result.diversityScore).toBe(0);
    expect(result.clusterCount).toBe(1);
  });

  test('orthogonal annotations return high diversity and multiple clusters', () => {
    const result = computeReviewDiversity([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(result.diversityScore).toBeCloseTo(1, 5);
    expect(result.clusterCount).toBe(3);
  });

  test('mixed annotations return intermediate diversity', () => {
    const result = computeReviewDiversity([
      [1, 0, 0],
      [1, 0, 0], // duplicate of first
      [0, 1, 0], // different
    ]);
    expect(result.diversityScore).toBeGreaterThan(0);
    expect(result.diversityScore).toBeLessThan(1);
    expect(result.clusterCount).toBe(2);
  });
});

describe('detectHomogenization', () => {
  test('tighter AI cluster triggers homogenization risk', () => {
    // AI proposals all very similar (tight cluster)
    const aiEmbeddings = [
      [1, 0.01, 0],
      [1, 0.02, 0],
      [1, -0.01, 0],
    ];
    // Non-AI proposals are diverse
    const nonAiEmbeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const result = detectHomogenization(aiEmbeddings, nonAiEmbeddings);
    expect(result.homogenizationRisk).toBe(true);
    expect(result.aiClusterTightness).toBeGreaterThan(result.nonAiClusterTightness);
  });

  test('diverse AI cluster does not trigger risk', () => {
    // AI proposals are diverse
    const aiEmbeddings = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    // Non-AI proposals are tight
    const nonAiEmbeddings = [
      [1, 0.01, 0],
      [1, 0.02, 0],
      [1, -0.01, 0],
    ];
    const result = detectHomogenization(aiEmbeddings, nonAiEmbeddings);
    expect(result.homogenizationRisk).toBe(false);
  });

  test('insufficient data does not flag risk', () => {
    const aiEmbeddings = [[1, 0, 0]]; // only 1
    const nonAiEmbeddings = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    const result = detectHomogenization(aiEmbeddings, nonAiEmbeddings);
    expect(result.homogenizationRisk).toBe(false);
  });

  test('both groups insufficient returns no risk', () => {
    const result = detectHomogenization([[1, 0, 0]], [[0, 1, 0]]);
    expect(result.homogenizationRisk).toBe(false);
    expect(result.aiClusterTightness).toBe(1); // 1 - 0 diversity
    expect(result.nonAiClusterTightness).toBe(1);
  });

  test('equal tightness does not flag risk', () => {
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    const result = detectHomogenization(embeddings, embeddings);
    expect(result.homogenizationRisk).toBe(false);
    expect(result.aiClusterTightness).toBeCloseTo(result.nonAiClusterTightness, 5);
  });
});
