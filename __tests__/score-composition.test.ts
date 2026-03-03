import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => false,
}));

import { calculateDRepScore, DEFAULT_WEIGHTS, blockTimeToEpoch } from '@/lib/koios';

// ── calculateDRepScore ───────────────────────────────────────────────────────

describe('calculateDRepScore', () => {
  it('returns weighted composite of all pillars', () => {
    const drep = {
      effectiveParticipation: 100,
      rationaleRate: 100,
      reliabilityScore: 100,
      profileCompleteness: 100,
    };
    expect(calculateDRepScore(drep)).toBe(100);
  });

  it('returns 0 for all-zero pillars', () => {
    const drep = {
      effectiveParticipation: 0,
      rationaleRate: 0,
      reliabilityScore: 0,
      profileCompleteness: 0,
    };
    expect(calculateDRepScore(drep)).toBe(0);
  });

  it('applies correct default weights (30/35/20/15)', () => {
    expect(DEFAULT_WEIGHTS.effectiveParticipation).toBe(0.3);
    expect(DEFAULT_WEIGHTS.rationale).toBe(0.35);
    expect(DEFAULT_WEIGHTS.reliability).toBe(0.2);
    expect(DEFAULT_WEIGHTS.profileCompleteness).toBe(0.15);

    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('only participation at 100 gives 30 points', () => {
    const drep = {
      effectiveParticipation: 100,
      rationaleRate: 0,
      reliabilityScore: 0,
      profileCompleteness: 0,
    };
    expect(calculateDRepScore(drep)).toBe(30);
  });

  it('only reliability at 100 gives 20 points', () => {
    const drep = {
      effectiveParticipation: 0,
      rationaleRate: 0,
      reliabilityScore: 100,
      profileCompleteness: 0,
    };
    expect(calculateDRepScore(drep)).toBe(20);
  });

  it('only profile at 100 gives 15 points', () => {
    const drep = {
      effectiveParticipation: 0,
      rationaleRate: 0,
      reliabilityScore: 0,
      profileCompleteness: 100,
    };
    expect(calculateDRepScore(drep)).toBe(15);
  });

  it('applies rationale curve to rationaleRate', () => {
    const drep = {
      effectiveParticipation: 0,
      rationaleRate: 100,
      reliabilityScore: 0,
      profileCompleteness: 0,
    };
    // applyRationaleCurve(100) = 100, so 100/100 * 0.35 * 100 = 35
    expect(calculateDRepScore(drep)).toBe(35);
  });

  it('rationale curve rewards early effort (20% raw -> ~30 adjusted)', () => {
    const drep20 = {
      effectiveParticipation: 0,
      rationaleRate: 20,
      reliabilityScore: 0,
      profileCompleteness: 0,
    };
    const drep10 = {
      effectiveParticipation: 0,
      rationaleRate: 10,
      reliabilityScore: 0,
      profileCompleteness: 0,
    };
    const score20 = calculateDRepScore(drep20);
    const score10 = calculateDRepScore(drep10);
    expect(score20).toBeGreaterThan(score10);
    // 20% raw -> 30 adjusted -> 30/100 * 0.35 * 100 = 10.5 -> rounds to 11
    expect(score20).toBe(11);
  });

  it('clamps to 0-100 range', () => {
    const drep = {
      effectiveParticipation: 200,
      rationaleRate: 200,
      reliabilityScore: 200,
      profileCompleteness: 200,
    };
    expect(calculateDRepScore(drep)).toBeLessThanOrEqual(100);
  });

  it('handles NaN/undefined pillar values gracefully (nullish coalescing to 0)', () => {
    const drep = {
      effectiveParticipation: undefined as any,
      rationaleRate: null as any,
      reliabilityScore: NaN,
      profileCompleteness: 50,
    };
    const score = calculateDRepScore(drep);
    expect(Number.isFinite(score)).toBe(true);
  });

  it('supports custom weights', () => {
    const drep = {
      effectiveParticipation: 100,
      rationaleRate: 0,
      reliabilityScore: 0,
      profileCompleteness: 0,
    };
    const customWeights = {
      effectiveParticipation: 1.0,
      rationale: 0,
      reliability: 0,
      profileCompleteness: 0,
    };
    expect(calculateDRepScore(drep, customWeights)).toBe(100);
  });

  it('produces realistic mixed scores', () => {
    const drep = {
      effectiveParticipation: 75,
      rationaleRate: 60,
      reliabilityScore: 80,
      profileCompleteness: 50,
    };
    const score = calculateDRepScore(drep);
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(80);
  });
});

// ── blockTimeToEpoch ─────────────────────────────────────────────────────────

describe('blockTimeToEpoch', () => {
  it('converts known block time to correct epoch', () => {
    // Shelley genesis: 1596491091, epoch length: 432000s, base epoch: 209
    // Epoch 210 starts at 1596491091 + 432000 = 1596923091
    const epoch210Start = 1596491091 + 432000;
    expect(blockTimeToEpoch(epoch210Start)).toBe(210);
  });

  it('handles Shelley genesis exactly (epoch 209)', () => {
    expect(blockTimeToEpoch(1596491091)).toBe(209);
  });

  it('produces reasonable epoch for recent timestamps', () => {
    // Feb 2026 timestamp
    const epoch = blockTimeToEpoch(1772000000);
    expect(epoch).toBeGreaterThan(500);
    expect(epoch).toBeLessThan(700);
  });

  it('is deterministic', () => {
    const t = 1700000000;
    expect(blockTimeToEpoch(t)).toBe(blockTimeToEpoch(t));
  });
});
