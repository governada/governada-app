import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import { computeDRepScores } from '@/lib/scoring/drepScore';
import { PILLAR_WEIGHTS } from '@/lib/scoring/types';
import {
  computeDRepConfidence,
  getDRepTierCap,
  getDRepConfidenceByVotes,
  dampenPercentile,
} from '@/lib/scoring/confidence';
import { computeTierWithCap } from '@/lib/scoring/tiers';

// ── Helpers ──

function makePillarMaps(
  drepScores: Record<string, { eq: number; ep: number; rl: number; gi: number }>,
) {
  const rawEngagement = new Map<string, number>();
  const rawParticipation = new Map<string, number>();
  const rawReliability = new Map<string, number>();
  const rawIdentity = new Map<string, number>();

  for (const [id, s] of Object.entries(drepScores)) {
    rawEngagement.set(id, s.eq);
    rawParticipation.set(id, s.ep);
    rawReliability.set(id, s.rl);
    rawIdentity.set(id, s.gi);
  }

  return { rawEngagement, rawParticipation, rawReliability, rawIdentity };
}

// ── Tests ──

describe('computeDRepScores', () => {
  it('computes composite from 4 percentile-normalized pillars', () => {
    const { rawEngagement, rawParticipation, rawReliability, rawIdentity } = makePillarMaps({
      d1: { eq: 80, ep: 70, rl: 60, gi: 50 },
      d2: { eq: 40, ep: 50, rl: 60, gi: 70 },
      d3: { eq: 60, ep: 60, rl: 60, gi: 60 },
    });

    const results = computeDRepScores(
      rawEngagement,
      rawParticipation,
      rawReliability,
      rawIdentity,
      new Map(),
    );

    expect(results.size).toBe(3);
    for (const [, result] of results) {
      expect(result.composite).toBeGreaterThanOrEqual(0);
      expect(result.composite).toBeLessThanOrEqual(100);
    }
  });

  it('preserves raw scores in the result', () => {
    const { rawEngagement, rawParticipation, rawReliability, rawIdentity } = makePillarMaps({
      d1: { eq: 80, ep: 70, rl: 60, gi: 50 },
    });

    const results = computeDRepScores(
      rawEngagement,
      rawParticipation,
      rawReliability,
      rawIdentity,
      new Map(),
    );

    const result = results.get('d1')!;
    expect(result.engagementQualityRaw).toBe(80);
    expect(result.effectiveParticipationRaw).toBe(70);
    expect(result.reliabilityRaw).toBe(60);
    expect(result.governanceIdentityRaw).toBe(50);
  });

  it('single DRep gets 50 percentile on all pillars', () => {
    const results = computeDRepScores(
      new Map([['solo', 75]]),
      new Map([['solo', 60]]),
      new Map([['solo', 80]]),
      new Map([['solo', 45]]),
      new Map(),
    );

    const result = results.get('solo')!;
    expect(result.engagementQualityPercentile).toBe(50);
    expect(result.effectiveParticipationPercentile).toBe(50);
    expect(result.reliabilityPercentile).toBe(50);
    expect(result.governanceIdentityPercentile).toBe(50);
    // Composite = 50 for all pillars
    expect(result.composite).toBe(50);
  });

  // ── Pillar weight verification ──

  it('uses correct pillar weights (35/25/25/15)', () => {
    expect(PILLAR_WEIGHTS.engagementQuality).toBe(0.35);
    expect(PILLAR_WEIGHTS.effectiveParticipation).toBe(0.25);
    expect(PILLAR_WEIGHTS.reliability).toBe(0.25);
    expect(PILLAR_WEIGHTS.governanceIdentity).toBe(0.15);

    const total = Object.values(PILLAR_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  // ── Percentile distribution ──

  it('produces valid percentile distribution with many DReps', () => {
    const rawEngagement = new Map<string, number>();
    const rawParticipation = new Map<string, number>();
    const rawReliability = new Map<string, number>();
    const rawIdentity = new Map<string, number>();

    for (let i = 0; i < 50; i++) {
      const id = `d${i}`;
      rawEngagement.set(id, i * 2);
      rawParticipation.set(id, i * 1.5 + 10);
      rawReliability.set(id, 100 - i * 2);
      rawIdentity.set(id, 30 + (i % 20) * 3);
    }

    const results = computeDRepScores(
      rawEngagement,
      rawParticipation,
      rawReliability,
      rawIdentity,
      new Map(),
    );

    expect(results.size).toBe(50);

    // Verify composites span a range (not all same)
    const composites = [...results.values()].map((r) => r.composite);
    const min = Math.min(...composites);
    const max = Math.max(...composites);
    expect(max - min).toBeGreaterThan(20);

    // All bounded
    for (const r of results.values()) {
      expect(r.composite).toBeGreaterThanOrEqual(0);
      expect(r.composite).toBeLessThanOrEqual(100);
    }
  });

  // ── Momentum ──

  it('computes positive momentum for improving scores', () => {
    const today = new Date();
    const history = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().slice(0, 10), score: 50 + i * 3 };
    });

    const results = computeDRepScores(
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', history]]),
    );

    const result = results.get('d1')!;
    expect(result.momentum).not.toBeNull();
    expect(result.momentum!).toBeGreaterThan(0);
  });

  it('computes negative momentum for declining scores', () => {
    const today = new Date();
    const history = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().slice(0, 10), score: 80 - i * 3 };
    });

    const results = computeDRepScores(
      new Map([['d1', 60]]),
      new Map([['d1', 60]]),
      new Map([['d1', 60]]),
      new Map([['d1', 60]]),
      new Map([['d1', history]]),
    );

    expect(results.get('d1')!.momentum!).toBeLessThan(0);
  });

  it('returns null momentum with insufficient history', () => {
    const results = computeDRepScores(
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', [{ date: '2026-01-01', score: 70 }]]]),
    );

    expect(results.get('d1')!.momentum).toBeNull();
  });

  it('returns null momentum when no history provided', () => {
    const results = computeDRepScores(
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map(),
    );

    expect(results.get('d1')!.momentum).toBeNull();
  });

  // ── Handles DReps appearing in some but not all pillars ──

  it('handles DReps present in some pillars but missing from others', () => {
    const results = computeDRepScores(
      new Map([['d1', 80]]),
      new Map([['d2', 60]]),
      new Map([
        ['d1', 70],
        ['d2', 50],
      ]),
      new Map([['d1', 40]]),
      new Map(),
    );

    // Both should have results, missing pillars default to 0 percentile
    expect(results.has('d1')).toBe(true);
    expect(results.has('d2')).toBe(true);
  });

  // ── Snapshot-style regression test ──

  it('produces stable output for fixed input (regression detection)', () => {
    const results = computeDRepScores(
      new Map([
        ['a', 90],
        ['b', 60],
        ['c', 30],
      ]),
      new Map([
        ['a', 85],
        ['b', 55],
        ['c', 25],
      ]),
      new Map([
        ['a', 80],
        ['b', 50],
        ['c', 20],
      ]),
      new Map([
        ['a', 75],
        ['b', 45],
        ['c', 15],
      ]),
      new Map(),
    );

    // With 3 DReps, all having distinct ordered scores and full confidence (default 100):
    // Weighted percentile normalization (midpoint formula):
    //   a is top in all pillars -> percentile ~83 each
    //   b is middle -> percentile 50
    //   c is bottom -> percentile ~17 each
    expect(results.get('a')!.composite).toBe(83);
    expect(results.get('b')!.composite).toBe(50);
    expect(results.get('c')!.composite).toBe(17);
  });

  // ── Confidence field ──

  it('includes confidence in result (defaults to 100 when not provided)', () => {
    const results = computeDRepScores(
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map([['d1', 70]]),
      new Map(),
    );

    expect(results.get('d1')!.confidence).toBe(100);
  });

  it('includes confidence in result when provided', () => {
    const confidences = new Map([
      ['d1', 50],
      ['d2', 100],
    ]);

    const results = computeDRepScores(
      new Map([
        ['d1', 70],
        ['d2', 80],
      ]),
      new Map([
        ['d1', 60],
        ['d2', 70],
      ]),
      new Map([
        ['d1', 50],
        ['d2', 60],
      ]),
      new Map([
        ['d1', 40],
        ['d2', 50],
      ]),
      new Map(),
      confidences,
    );

    expect(results.get('d1')!.confidence).toBe(50);
    expect(results.get('d2')!.confidence).toBe(100);
  });

  // ── Confidence dampening ──

  it('dampens low-confidence DRep percentiles toward median', () => {
    // Three DReps: d1 (top, low confidence) should be pulled toward median.
    // d3 (top, full confidence) should NOT be pulled toward median.
    const confidences = new Map([
      ['d1', 50],
      ['d2', 100],
      ['d3', 100],
    ]);

    const results = computeDRepScores(
      new Map([
        ['d1', 90],
        ['d2', 50],
        ['d3', 90],
      ]),
      new Map([
        ['d1', 90],
        ['d2', 50],
        ['d3', 90],
      ]),
      new Map([
        ['d1', 90],
        ['d2', 50],
        ['d3', 90],
      ]),
      new Map([
        ['d1', 90],
        ['d2', 50],
        ['d3', 90],
      ]),
      new Map(),
      confidences,
    );

    const d1 = results.get('d1')!;
    const d3 = results.get('d3')!;

    // d1 (low confidence) should score lower than d3 (full confidence)
    // because dampening pulls d1 toward 50
    expect(d1.composite).toBeLessThan(d3.composite);
    // d1 should be closer to 50 than d3 is
    expect(Math.abs(d1.composite - 50)).toBeLessThan(Math.abs(d3.composite - 50));
  });
});

// ── DRep Confidence Tests ──

describe('computeDRepConfidence', () => {
  it('returns 0 for DRep with no votes', () => {
    expect(computeDRepConfidence(0, 0, 0)).toBe(0);
  });

  it('returns higher confidence with more votes', () => {
    const low = computeDRepConfidence(2, 0, 0);
    const mid = computeDRepConfidence(10, 0, 0);
    const high = computeDRepConfidence(30, 0, 0);
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('accounts for epoch span', () => {
    const noSpan = computeDRepConfidence(5, 0, 0);
    const withSpan = computeDRepConfidence(5, 10, 0);
    expect(withSpan).toBeGreaterThan(noSpan);
  });

  it('accounts for type coverage', () => {
    const noCoverage = computeDRepConfidence(5, 5, 0);
    const withCoverage = computeDRepConfidence(5, 5, 0.5);
    expect(withCoverage).toBeGreaterThan(noCoverage);
  });

  it('returns value between 0 and 100', () => {
    const confidence = computeDRepConfidence(100, 50, 1.0);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });
});

describe('getDRepTierCap', () => {
  it('caps 0-vote DReps at Emerging', () => {
    expect(getDRepTierCap(0)).toBe('Emerging');
    expect(getDRepTierCap(4)).toBe('Emerging');
  });

  it('caps 5-9 vote DReps at Bronze', () => {
    expect(getDRepTierCap(5)).toBe('Bronze');
    expect(getDRepTierCap(9)).toBe('Bronze');
  });

  it('caps 10-14 vote DReps at Silver', () => {
    expect(getDRepTierCap(10)).toBe('Silver');
    expect(getDRepTierCap(14)).toBe('Silver');
  });

  it('returns null (no cap) for 15+ votes', () => {
    expect(getDRepTierCap(15)).toBeNull();
    expect(getDRepTierCap(100)).toBeNull();
  });
});

describe('getDRepConfidenceByVotes', () => {
  it('returns 50 for 0-4 votes', () => {
    expect(getDRepConfidenceByVotes(0)).toBe(50);
    expect(getDRepConfidenceByVotes(4)).toBe(50);
  });

  it('returns 75 for 5-9 votes', () => {
    expect(getDRepConfidenceByVotes(5)).toBe(75);
    expect(getDRepConfidenceByVotes(9)).toBe(75);
  });

  it('returns 90 for 10-14 votes', () => {
    expect(getDRepConfidenceByVotes(10)).toBe(90);
    expect(getDRepConfidenceByVotes(14)).toBe(90);
  });

  it('returns 100 for 15+ votes', () => {
    expect(getDRepConfidenceByVotes(15)).toBe(100);
    expect(getDRepConfidenceByVotes(200)).toBe(100);
  });
});

describe('dampenPercentile', () => {
  it('returns raw score unchanged at 100% confidence', () => {
    expect(dampenPercentile(90, 100)).toBe(90);
    expect(dampenPercentile(10, 100)).toBe(10);
  });

  it('returns 50 (median) at 0% confidence', () => {
    expect(dampenPercentile(90, 0)).toBe(50);
    expect(dampenPercentile(10, 0)).toBe(50);
    expect(dampenPercentile(50, 0)).toBe(50);
  });

  it('moves score halfway toward median at 50% confidence', () => {
    // 90 -> median 50, halfway = 70
    expect(dampenPercentile(90, 50)).toBe(70);
    // 10 -> median 50, halfway = 30
    expect(dampenPercentile(10, 50)).toBe(30);
  });

  it('preserves median at any confidence', () => {
    expect(dampenPercentile(50, 0)).toBe(50);
    expect(dampenPercentile(50, 50)).toBe(50);
    expect(dampenPercentile(50, 100)).toBe(50);
  });
});

describe('computeTierWithCap', () => {
  it('applies tier cap when score exceeds it', () => {
    // Score 90 would be Diamond, but capped at Emerging
    expect(computeTierWithCap(90, 'Emerging')).toBe('Emerging');
    // Score 60 would be Silver, but capped at Bronze
    expect(computeTierWithCap(60, 'Bronze')).toBe('Bronze');
  });

  it('allows tier at or below cap', () => {
    // Score 35 is Emerging, cap at Silver — no restriction
    expect(computeTierWithCap(35, 'Silver')).toBe('Emerging');
    // Score 45 is Bronze, cap at Bronze — at boundary
    expect(computeTierWithCap(45, 'Bronze')).toBe('Bronze');
  });

  it('returns uncapped tier when maxTier is null', () => {
    expect(computeTierWithCap(90, null)).toBe('Diamond');
    expect(computeTierWithCap(45, null)).toBe('Bronze');
  });
});
