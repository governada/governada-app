import { describe, it, expect } from 'vitest';
import { applyEasing } from '@/lib/globe/easing';

describe('applyEasing', () => {
  it.each(['linear', 'ease-in-out', 'ease-out', 'spring'] as const)(
    '%s: returns 0 at t=0',
    (curve) => {
      expect(applyEasing(0, curve)).toBe(0);
    },
  );

  it.each(['linear', 'ease-in-out', 'ease-out', 'spring'] as const)(
    '%s: returns 1 at t=1',
    (curve) => {
      expect(applyEasing(1, curve)).toBeCloseTo(1, 4);
    },
  );

  it('linear: identity function', () => {
    expect(applyEasing(0.25, 'linear')).toBe(0.25);
    expect(applyEasing(0.5, 'linear')).toBe(0.5);
    expect(applyEasing(0.75, 'linear')).toBe(0.75);
  });

  it('ease-in-out: slow start and end, fast middle', () => {
    const quarter = applyEasing(0.25, 'ease-in-out');
    const half = applyEasing(0.5, 'ease-in-out');
    const threeQuarters = applyEasing(0.75, 'ease-in-out');
    expect(quarter).toBeLessThan(0.25); // slower than linear at start
    expect(half).toBeCloseTo(0.5, 1); // crosses mid at t=0.5
    expect(threeQuarters).toBeGreaterThan(0.75); // faster than linear near end
  });

  it('ease-out: fast start, slow end', () => {
    const quarter = applyEasing(0.25, 'ease-out');
    const half = applyEasing(0.5, 'ease-out');
    expect(quarter).toBeGreaterThan(0.25); // faster than linear
    expect(half).toBeGreaterThan(0.5);
  });

  it('spring: overshoots slightly then settles', () => {
    // Spring should go above 1.0 at some point
    let foundOvershoot = false;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = applyEasing(t, 'spring');
      if (v > 1.01) foundOvershoot = true;
    }
    expect(foundOvershoot).toBe(true);
  });

  it('clamps input to [0, 1]', () => {
    expect(applyEasing(-0.5, 'linear')).toBe(0);
    expect(applyEasing(1.5, 'linear')).toBe(1);
  });

  it('monotonically increasing for non-spring curves', () => {
    for (const curve of ['linear', 'ease-in-out', 'ease-out'] as const) {
      let prev = 0;
      for (let t = 0; t <= 1; t += 0.01) {
        const v = applyEasing(t, curve);
        expect(v).toBeGreaterThanOrEqual(prev - 0.001); // small tolerance for float
        prev = v;
      }
    }
  });
});
