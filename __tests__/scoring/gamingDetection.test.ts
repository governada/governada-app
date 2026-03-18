/**
 * Gaming Detection Tests
 *
 * Tests the pure computation functions from gamingDetection.ts.
 * Since the actual functions make DB calls, we test the underlying logic
 * by importing the embedding quality/query helpers and verifying the
 * detection thresholds work correctly with synthetic data.
 */

import { describe, test, expect } from 'vitest';
import { computePairwiseDiversity, computeCentroid } from '@/lib/embeddings/quality';
import { cosineSimilarity } from '@/lib/embeddings/query';

// ---------------------------------------------------------------------------
// Rationale Farm Detection Logic
// ---------------------------------------------------------------------------

describe('Rationale Farm Detection', () => {
  test('high-similarity set (> 0.92) is flagged as suspect', () => {
    // Simulate near-identical rationale embeddings
    const baseVector = [1, 0.1, 0.05, 0.02, 0];
    const vectors = [
      baseVector,
      [1, 0.11, 0.04, 0.02, 0.01],
      [1, 0.09, 0.06, 0.01, 0],
      [1, 0.1, 0.05, 0.03, 0.01],
      [1, 0.12, 0.04, 0.02, 0],
      [1, 0.1, 0.05, 0.02, 0.01],
      [1, 0.11, 0.05, 0.01, 0],
      [1, 0.09, 0.06, 0.02, 0.01],
      [1, 0.1, 0.04, 0.03, 0],
      [1, 0.11, 0.05, 0.02, 0.01],
    ];

    const diversity = computePairwiseDiversity(vectors);
    const meanSimilarity = 1 - diversity;

    // These near-identical vectors should have very high mean similarity
    expect(meanSimilarity).toBeGreaterThan(0.92);
    expect(vectors.length).toBeGreaterThanOrEqual(10);

    // This would trigger the suspect flag
    const isSuspect = meanSimilarity > 0.92;
    expect(isSuspect).toBe(true);
  });

  test('diverse rationale set is not flagged as suspect', () => {
    // Simulate genuinely diverse rationales
    const vectors = [
      [1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1],
      [1, 1, 0, 0, 0],
      [0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 0, 0, 1, 1],
      [1, 0, 0, 0, 1],
    ];

    const diversity = computePairwiseDiversity(vectors);
    const meanSimilarity = 1 - diversity;

    // Diverse set should have low mean similarity
    expect(meanSimilarity).toBeLessThan(0.92);

    const isSuspect = meanSimilarity > 0.92;
    expect(isSuspect).toBe(false);
  });

  test('fewer than 10 rationales should not be assessed', () => {
    const vectors = [
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
    ];

    // Even with identical rationales, fewer than 10 should not trigger
    const rationaleCount = vectors.length;
    expect(rationaleCount).toBeLessThan(10);

    // The function returns early for < 10 rationales
    const isSuspect = rationaleCount >= 10 && 1 - computePairwiseDiversity(vectors) > 0.92;
    expect(isSuspect).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Template Detection Logic
// ---------------------------------------------------------------------------

describe('Template Detection', () => {
  test('identical embeddings from different DReps form a cluster', () => {
    // Simulate 6+ DReps with near-identical rationales
    const baseVector = [1, 0.5, 0.2];

    const drepEmbeddings = new Map<string, number[]>();
    for (let i = 0; i < 8; i++) {
      drepEmbeddings.set(`drep_${i}`, [
        baseVector[0] + Math.random() * 0.01,
        baseVector[1] + Math.random() * 0.01,
        baseVector[2] + Math.random() * 0.01,
      ]);
    }

    const entries = Array.from(drepEmbeddings.entries());
    const clusterMembers: string[] = [entries[0][0]];
    const clusterVectors: number[][] = [entries[0][1]];

    for (let j = 1; j < entries.length; j++) {
      const similarities = clusterVectors.map((v) => cosineSimilarity(v, entries[j][1]));
      const minSim = Math.min(...similarities);

      if (minSim > 0.95) {
        clusterMembers.push(entries[j][0]);
        clusterVectors.push(entries[j][1]);
      }
    }

    // Near-identical vectors should cluster
    expect(clusterMembers.length).toBeGreaterThan(5);

    // Centroid distance should be very small
    const centroid = computeCentroid(clusterVectors);
    const distances = clusterVectors.map((v) => 1 - cosineSimilarity(v, centroid));
    const avgDistance = distances.reduce((s, d) => s + d, 0) / distances.length;

    expect(avgDistance).toBeLessThan(0.05);
  });

  test('diverse rationales from different DReps do not cluster', () => {
    const drepEmbeddings = new Map<string, number[]>([
      ['drep_0', [1, 0, 0]],
      ['drep_1', [0, 1, 0]],
      ['drep_2', [0, 0, 1]],
      ['drep_3', [1, 1, 0]],
      ['drep_4', [0, 1, 1]],
      ['drep_5', [1, 0, 1]],
      ['drep_6', [1, 1, 1]],
      ['drep_7', [-1, 0, 0]],
    ]);

    const entries = Array.from(drepEmbeddings.entries());
    const clusterMembers: string[] = [entries[0][0]];
    const clusterVectors: number[][] = [entries[0][1]];

    for (let j = 1; j < entries.length; j++) {
      const similarities = clusterVectors.map((v) => cosineSimilarity(v, entries[j][1]));
      const minSim = Math.min(...similarities);

      if (minSim > 0.95) {
        clusterMembers.push(entries[j][0]);
        clusterVectors.push(entries[j][1]);
      }
    }

    // Diverse vectors should not form large clusters
    expect(clusterMembers.length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Profile-Vote Hypocrisy Logic
// ---------------------------------------------------------------------------

describe('Profile-Vote Hypocrisy', () => {
  test('aligned profile and rationales yield high consistency score', () => {
    // Profile emphasizes decentralization
    const profileEmb = [1, 0.8, 0.3, 0, 0];

    // Rationale embeddings also emphasize decentralization
    const rationaleEmbs = [
      [0.9, 0.7, 0.4, 0.1, 0],
      [1, 0.9, 0.2, 0, 0.1],
      [0.8, 0.8, 0.3, 0.1, 0.1],
    ];

    const rationaleCentroid = computeCentroid(rationaleEmbs);
    const similarity = cosineSimilarity(profileEmb, rationaleCentroid);
    const consistencyScore = Math.round(Math.max(0, similarity) * 100);

    expect(consistencyScore).toBeGreaterThan(20);
    expect(consistencyScore).toBeGreaterThan(80); // aligned should be very high
  });

  test('mismatched profile and rationales yield low consistency score', () => {
    // Profile emphasizes one direction
    const profileEmb = [1, 0, 0, 0, 0];

    // Rationales go in opposite direction
    const rationaleEmbs = [
      [0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
    ];

    const rationaleCentroid = computeCentroid(rationaleEmbs);
    const similarity = cosineSimilarity(profileEmb, rationaleCentroid);
    const consistencyScore = Math.round(Math.max(0, similarity) * 100);

    // Orthogonal vectors = low consistency
    expect(consistencyScore).toBeLessThan(50);
  });

  test('opposite profile and rationales flagged as mismatch', () => {
    // Profile points in one direction
    const profileEmb = [1, 0, 0];

    // Rationales point in opposite direction
    const rationaleEmbs = [
      [-1, 0.1, 0],
      [-1, -0.1, 0],
      [-0.9, 0, 0.1],
    ];

    const rationaleCentroid = computeCentroid(rationaleEmbs);
    const similarity = cosineSimilarity(profileEmb, rationaleCentroid);
    const consistencyScore = Math.round(Math.max(0, similarity) * 100);

    const isMismatch = consistencyScore < 20;
    expect(isMismatch).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Enhanced Sybil Detection Logic
// ---------------------------------------------------------------------------

describe('Enhanced Sybil Detection', () => {
  test('high vote correlation + high rationale correlation = high confidence', () => {
    // Simulate two pools with identical rationale centroids
    const centroidA = [1, 0.5, 0.2];
    const centroidB = [0.99, 0.51, 0.19]; // nearly identical

    const rationaleCorrelation = cosineSimilarity(centroidA, centroidB);
    const voteAgreementRate = 0.97; // > 95%

    expect(rationaleCorrelation).toBeGreaterThan(0.9);

    const highConfidence = voteAgreementRate > 0.95 && rationaleCorrelation > 0.9;
    expect(highConfidence).toBe(true);
  });

  test('high vote correlation but low rationale correlation = not high confidence', () => {
    // Different rationale patterns despite same votes
    const centroidA = [1, 0, 0];
    const centroidB = [0, 1, 0]; // orthogonal

    const rationaleCorrelation = cosineSimilarity(centroidA, centroidB);
    const voteAgreementRate = 0.97;

    expect(rationaleCorrelation).toBeLessThan(0.9);

    const highConfidence = voteAgreementRate > 0.95 && rationaleCorrelation > 0.9;
    expect(highConfidence).toBe(false);
  });

  test('low vote correlation should not flag even with identical rationales', () => {
    const centroidA = [1, 0.5, 0.2];
    const centroidB = [1, 0.5, 0.2]; // identical

    const rationaleCorrelation = cosineSimilarity(centroidA, centroidB);
    const voteAgreementRate = 0.8; // below 95% threshold

    expect(rationaleCorrelation).toBeCloseTo(1, 5);

    const highConfidence = voteAgreementRate > 0.95 && rationaleCorrelation > 0.9;
    expect(highConfidence).toBe(false);
  });
});
