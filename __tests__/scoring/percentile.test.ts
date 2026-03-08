import { describe, it, expect } from 'vitest';

import { percentileNormalize } from '@/lib/scoring/percentile';

describe('percentileNormalize', () => {
  it('returns empty map for empty input', () => {
    expect(percentileNormalize(new Map()).size).toBe(0);
  });

  it('returns 50 for single entry', () => {
    const result = percentileNormalize(new Map([['solo', 42]]));
    expect(result.get('solo')).toBe(50);
  });

  it('assigns 0 to lowest and 100 to highest with 2 entries', () => {
    const result = percentileNormalize(
      new Map([
        ['low', 10],
        ['high', 90],
      ]),
    );
    expect(result.get('low')).toBe(0);
    expect(result.get('high')).toBe(100);
  });

  it('assigns average rank to tied scores', () => {
    const result = percentileNormalize(
      new Map([
        ['a', 50],
        ['b', 50],
        ['c', 100],
      ]),
    );
    // a and b are tied at rank 0 and 1 → avg rank 0.5
    // percentile = (0.5 / 2) * 100 = 25
    expect(result.get('a')).toBe(result.get('b'));
    expect(result.get('a')).toBe(25);
    expect(result.get('c')).toBe(100);
  });

  it('produces evenly spread percentiles for distinct values', () => {
    const input = new Map([
      ['d1', 10],
      ['d2', 20],
      ['d3', 30],
      ['d4', 40],
      ['d5', 50],
    ]);
    const result = percentileNormalize(input);

    expect(result.get('d1')).toBe(0);
    expect(result.get('d2')).toBe(25);
    expect(result.get('d3')).toBe(50);
    expect(result.get('d4')).toBe(75);
    expect(result.get('d5')).toBe(100);
  });

  it('handles all same values (all tied)', () => {
    const result = percentileNormalize(
      new Map([
        ['a', 50],
        ['b', 50],
        ['c', 50],
      ]),
    );
    // All tied → avg rank = 1, percentile = (1/2)*100 = 50
    expect(result.get('a')).toBe(50);
    expect(result.get('b')).toBe(50);
    expect(result.get('c')).toBe(50);
  });

  it('produces values in 0-100 range for large input', () => {
    const input = new Map<string, number>();
    for (let i = 0; i < 100; i++) {
      input.set(`d${i}`, Math.random() * 100);
    }
    const result = percentileNormalize(input);

    for (const [, pct] of result) {
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it('preserves relative ordering', () => {
    const input = new Map([
      ['worst', 5],
      ['mid', 50],
      ['best', 95],
    ]);
    const result = percentileNormalize(input);
    expect(result.get('worst')!).toBeLessThan(result.get('mid')!);
    expect(result.get('mid')!).toBeLessThan(result.get('best')!);
  });
});
