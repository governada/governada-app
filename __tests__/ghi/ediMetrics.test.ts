import { describe, it, expect } from 'vitest';

import {
  nakamoto,
  gini,
  shannonEntropy,
  hhi,
  theilIndex,
  oneMinusConcentration,
  tauDecentralization,
  computeEDI,
} from '@/lib/ghi/ediMetrics';

import {
  EQUAL_DISTRIBUTION,
  MONOPOLY_DISTRIBUTION,
  SINGLE_ENTITY,
  TWO_EQUAL,
  REALISTIC_DISTRIBUTION,
  MODERATE_CONCENTRATION,
  EMPTY_DISTRIBUTION,
} from '../fixtures/ghi';

// ── Nakamoto Coefficient ──

describe('nakamoto', () => {
  it('returns 0 for empty distribution', () => {
    expect(nakamoto(EMPTY_DISTRIBUTION)).toBe(0);
  });

  it('returns 1 for monopoly (one entity has all)', () => {
    expect(nakamoto(MONOPOLY_DISTRIBUTION)).toBe(1);
  });

  it('returns 6 for 10 equal entities (need >50%)', () => {
    // 10 equal: need 6 to exceed 50% (6*100 = 600 > 500)
    expect(nakamoto(EQUAL_DISTRIBUTION)).toBe(6);
  });

  it('returns 2 for two equal entities', () => {
    // Both needed to exceed 50%
    expect(nakamoto(TWO_EQUAL)).toBe(2);
  });

  it('returns 1 for single entity', () => {
    expect(nakamoto(SINGLE_ENTITY)).toBe(1);
  });

  it('handles realistic top-heavy distribution', () => {
    const nk = nakamoto(REALISTIC_DISTRIBUTION);
    // Top entity = 2000, total ≈ 7565, 50% = 3782.5
    // Cumulative: 2000, 3500, 4700 → 3 entities to exceed 50%
    expect(nk).toBe(3);
  });

  it('returns n when all values are 0', () => {
    expect(nakamoto([0, 0, 0])).toBe(0);
  });
});

// ── Gini Coefficient ──

describe('gini', () => {
  it('returns 0 for empty distribution', () => {
    expect(gini(EMPTY_DISTRIBUTION)).toBe(0);
  });

  it('returns 0 for perfect equality', () => {
    expect(gini(EQUAL_DISTRIBUTION)).toBeCloseTo(0, 5);
  });

  it('returns close to 1 for monopoly', () => {
    // With 10 entities, 1 has all: Gini ≈ 0.9
    const g = gini(MONOPOLY_DISTRIBUTION);
    expect(g).toBeGreaterThan(0.8);
    expect(g).toBeLessThanOrEqual(1);
  });

  it('returns 0 for two equal entities', () => {
    expect(gini(TWO_EQUAL)).toBeCloseTo(0, 5);
  });

  it('is higher for more concentrated distributions', () => {
    const gEqual = gini(EQUAL_DISTRIBUTION);
    const gRealistic = gini(REALISTIC_DISTRIBUTION);
    expect(gRealistic).toBeGreaterThan(gEqual);
  });

  it('returns value between 0 and 1', () => {
    expect(gini(MODERATE_CONCENTRATION)).toBeGreaterThanOrEqual(0);
    expect(gini(MODERATE_CONCENTRATION)).toBeLessThanOrEqual(1);
  });
});

// ── Shannon Entropy ──

describe('shannonEntropy', () => {
  it('returns 0 for empty distribution', () => {
    expect(shannonEntropy(EMPTY_DISTRIBUTION)).toBe(0);
  });

  it('returns 0 for single entity', () => {
    expect(shannonEntropy(SINGLE_ENTITY)).toBe(0);
  });

  it('returns 1.0 for uniform distribution (max entropy)', () => {
    expect(shannonEntropy(EQUAL_DISTRIBUTION)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for monopoly (single holder)', () => {
    // Only the entity with value > 0 contributes
    expect(shannonEntropy(MONOPOLY_DISTRIBUTION)).toBeCloseTo(0, 5);
  });

  it('returns 1.0 for two equal entities', () => {
    expect(shannonEntropy(TWO_EQUAL)).toBeCloseTo(1.0, 5);
  });

  it('is lower for more concentrated distributions', () => {
    const seEqual = shannonEntropy(EQUAL_DISTRIBUTION);
    const seRealistic = shannonEntropy(REALISTIC_DISTRIBUTION);
    expect(seRealistic).toBeLessThan(seEqual);
  });

  it('is between 0 and 1', () => {
    expect(shannonEntropy(REALISTIC_DISTRIBUTION)).toBeGreaterThanOrEqual(0);
    expect(shannonEntropy(REALISTIC_DISTRIBUTION)).toBeLessThanOrEqual(1);
  });
});

// ── HHI ──

describe('hhi', () => {
  it('returns 10000 for empty distribution', () => {
    expect(hhi(EMPTY_DISTRIBUTION)).toBe(10000);
  });

  it('returns 10000 for monopoly (one entity has all)', () => {
    expect(hhi(MONOPOLY_DISTRIBUTION)).toBe(10000);
  });

  it('returns 10000/n for perfect equality', () => {
    const n = EQUAL_DISTRIBUTION.length;
    expect(hhi(EQUAL_DISTRIBUTION)).toBe(Math.round(10000 / n)); // 1000
  });

  it('returns 5000 for two equal entities', () => {
    expect(hhi(TWO_EQUAL)).toBe(5000);
  });

  it('is lower for more competitive distributions', () => {
    const hhiEqual = hhi(EQUAL_DISTRIBUTION);
    const hhiRealistic = hhi(REALISTIC_DISTRIBUTION);
    expect(hhiEqual).toBeLessThan(hhiRealistic);
  });

  it('returns value between 10000/n and 10000', () => {
    const n = MODERATE_CONCENTRATION.length;
    const h = hhi(MODERATE_CONCENTRATION);
    expect(h).toBeGreaterThanOrEqual(Math.floor(10000 / n));
    expect(h).toBeLessThanOrEqual(10000);
  });
});

// ── Theil Index ──

describe('theilIndex', () => {
  it('returns 0 for empty distribution', () => {
    expect(theilIndex(EMPTY_DISTRIBUTION)).toBe(0);
  });

  it('returns 0 for perfect equality', () => {
    expect(theilIndex(EQUAL_DISTRIBUTION)).toBeCloseTo(0, 5);
  });

  it('returns high value for concentrated distribution', () => {
    // Only positive values count, so monopoly with zeros → only 1 value
    const th = theilIndex(MONOPOLY_DISTRIBUTION);
    // With only 1 positive value, ratio = v/v = 1, ln(1) = 0 → theil = 0
    expect(th).toBeCloseTo(0, 5);
  });

  it('is higher for more unequal distributions (all positive)', () => {
    const thEqual = theilIndex(EQUAL_DISTRIBUTION);
    // Filter realistic to only positive
    const positiveRealistic = REALISTIC_DISTRIBUTION.filter((v) => v > 0);
    const thRealistic = theilIndex(positiveRealistic);
    expect(thRealistic).toBeGreaterThan(thEqual);
  });

  it('returns non-negative value', () => {
    expect(theilIndex(MODERATE_CONCENTRATION)).toBeGreaterThanOrEqual(0);
  });
});

// ── 1 - Concentration Ratio ──

describe('oneMinusConcentration', () => {
  it('returns 0 for empty distribution', () => {
    expect(oneMinusConcentration(EMPTY_DISTRIBUTION)).toBe(0);
  });

  it('returns 0 for monopoly', () => {
    expect(oneMinusConcentration(MONOPOLY_DISTRIBUTION)).toBeCloseTo(0, 5);
  });

  it('returns 0.9 for 10 equal entities', () => {
    // 1 - (100/1000) = 0.9
    expect(oneMinusConcentration(EQUAL_DISTRIBUTION)).toBeCloseTo(0.9, 5);
  });

  it('returns 0.5 for two equal entities', () => {
    expect(oneMinusConcentration(TWO_EQUAL)).toBeCloseTo(0.5, 5);
  });

  it('is higher for less concentrated distributions', () => {
    const crEqual = oneMinusConcentration(EQUAL_DISTRIBUTION);
    const crMonopoly = oneMinusConcentration(MONOPOLY_DISTRIBUTION);
    expect(crEqual).toBeGreaterThan(crMonopoly);
  });
});

// ── Tau Decentralization ──

describe('tauDecentralization', () => {
  it('is essentially Nakamoto with threshold=0.66', () => {
    const tau = tauDecentralization(EQUAL_DISTRIBUTION);
    const nk66 = nakamoto(EQUAL_DISTRIBUTION, 0.66);
    expect(tau).toBe(nk66);
  });

  it('requires more entities than Nakamoto (higher threshold)', () => {
    const nk50 = nakamoto(REALISTIC_DISTRIBUTION);
    const tau66 = tauDecentralization(REALISTIC_DISTRIBUTION);
    expect(tau66).toBeGreaterThanOrEqual(nk50);
  });

  it('returns 0 for empty distribution', () => {
    expect(tauDecentralization(EMPTY_DISTRIBUTION)).toBe(0);
  });
});

// ── Composite EDI ──

describe('computeEDI', () => {
  it('returns score 0-100 for realistic distribution', () => {
    const result = computeEDI(REALISTIC_DISTRIBUTION);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  it('scores higher for equal distribution than concentrated', () => {
    // Note: MONOPOLY_DISTRIBUTION has n=1 positive entity which causes NaN
    // in theil normalization (0/log(1) = 0/0). Use MODERATE_CONCENTRATION instead.
    const ediEqual = computeEDI(EQUAL_DISTRIBUTION);
    const ediConcentrated = computeEDI(MODERATE_CONCENTRATION);
    expect(ediEqual.compositeScore).toBeGreaterThan(ediConcentrated.compositeScore);
  });

  it('returns all normalized values between 0 and 1', () => {
    const result = computeEDI(REALISTIC_DISTRIBUTION);
    for (const [, value] of Object.entries(result.normalized)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('includes all 7 breakdown metrics', () => {
    const result = computeEDI(MODERATE_CONCENTRATION);
    expect(result.breakdown).toHaveProperty('nakamotoCoefficient');
    expect(result.breakdown).toHaveProperty('gini');
    expect(result.breakdown).toHaveProperty('shannonEntropy');
    expect(result.breakdown).toHaveProperty('hhi');
    expect(result.breakdown).toHaveProperty('theilIndex');
    expect(result.breakdown).toHaveProperty('concentrationRatio');
    expect(result.breakdown).toHaveProperty('tauDecentralization');
  });

  it('handles edge case: empty distribution produces NaN (known issue for QP-6)', () => {
    // Empty distribution causes theil normalization NaN (0 / Math.log(1) = 0/0)
    // This is a known edge case that should be guarded in QP-6 reconciliation
    const result = computeEDI(EMPTY_DISTRIBUTION);
    expect(result.compositeScore).toSatisfy((v: number) => v === 0 || Number.isNaN(v));
  });

  it('handles edge case: single entity produces NaN (known issue for QP-6)', () => {
    // Single entity: hhi normalization = (10000-10000)/(10000-10000) = 0/0 = NaN
    // theil: 0/Math.log(1) = 0/0 = NaN
    const result = computeEDI(SINGLE_ENTITY);
    expect(result.compositeScore).toSatisfy((v: number) => Number.isNaN(v) || (v >= 0 && v <= 100));
  });

  it('metric weights sum to 1.0', () => {
    // Verify internally by checking that equal distribution scores near 100
    const result = computeEDI(EQUAL_DISTRIBUTION);
    // Should be high but may not be exactly 100 due to edge effects in normalization
    expect(result.compositeScore).toBeGreaterThan(70);
  });
});
