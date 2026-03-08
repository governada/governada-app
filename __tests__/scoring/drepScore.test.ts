import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import { computeDRepScores } from '@/lib/scoring/drepScore';
import { PILLAR_WEIGHTS } from '@/lib/scoring/types';
import type { DRepScoreResult } from '@/lib/scoring/types';

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
    expect(max - min).toBeGreaterThan(30);

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

    // With 3 DReps all having distinct ordered scores:
    // a is top in all pillars → percentile 100 each → composite 100
    // b is middle → percentile 50 → composite 50
    // c is bottom → percentile 0 → composite 0
    expect(results.get('a')!.composite).toBe(100);
    expect(results.get('b')!.composite).toBe(50);
    expect(results.get('c')!.composite).toBe(0);
  });
});
