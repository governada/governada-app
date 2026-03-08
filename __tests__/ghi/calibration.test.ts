import { describe, it, expect } from 'vitest';

import { calibrate, CALIBRATION, type CalibrationCurve } from '@/lib/ghi/calibration';

// ── Helpers ──

const testCurve: CalibrationCurve = {
  floor: 20,
  targetLow: 40,
  targetHigh: 70,
  ceiling: 90,
};

describe('calibrate', () => {
  // ── Breakpoint behavior ──

  it('maps floor to 20', () => {
    expect(calibrate(20, testCurve)).toBeCloseTo(20, 5);
  });

  it('maps targetLow to 50', () => {
    expect(calibrate(40, testCurve)).toBeCloseTo(50, 5);
  });

  it('maps targetHigh to 80', () => {
    expect(calibrate(70, testCurve)).toBeCloseTo(80, 5);
  });

  it('maps ceiling to 95', () => {
    expect(calibrate(90, testCurve)).toBeCloseTo(95, 5);
  });

  // ── Below floor ──

  it('maps values below floor to 0-20 range', () => {
    const result = calibrate(10, testCurve);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(20);
  });

  it('maps 0 to (0/floor)*20 = 0 when floor > 0', () => {
    expect(calibrate(0, testCurve)).toBeCloseTo(0, 5);
  });

  it('maps 0 to 0 when floor = 0', () => {
    const zeroFloor: CalibrationCurve = { floor: 0, targetLow: 30, targetHigh: 60, ceiling: 80 };
    expect(calibrate(0, zeroFloor)).toBe(0);
  });

  // ── Above ceiling ──

  it('caps at 95 for values above ceiling', () => {
    expect(calibrate(100, testCurve)).toBe(95);
    expect(calibrate(200, testCurve)).toBe(95);
  });

  // ── Linear interpolation between breakpoints ──

  it('interpolates linearly between floor and targetLow (20-50)', () => {
    // Midpoint: (20+40)/2 = 30 → should map to (20+50)/2 = 35
    expect(calibrate(30, testCurve)).toBeCloseTo(35, 0);
  });

  it('interpolates linearly between targetLow and targetHigh (50-80)', () => {
    // Midpoint: (40+70)/2 = 55 → should map to (50+80)/2 = 65
    expect(calibrate(55, testCurve)).toBeCloseTo(65, 0);
  });

  it('interpolates linearly between targetHigh and ceiling (80-95)', () => {
    // Midpoint: (70+90)/2 = 80 → should map to (80+95)/2 = 87.5
    expect(calibrate(80, testCurve)).toBeCloseTo(87.5, 0);
  });

  // ── Monotonic (calibrated score never decreases as raw increases) ──

  it('is monotonically non-decreasing', () => {
    let prev = calibrate(0, testCurve);
    for (let raw = 1; raw <= 100; raw++) {
      const current = calibrate(raw, testCurve);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });

  // ── All pre-configured calibration curves ──

  describe('pre-configured CALIBRATION curves', () => {
    const curveNames = Object.keys(CALIBRATION) as Array<keyof typeof CALIBRATION>;

    for (const name of curveNames) {
      it(`${name}: produces values in 0-95 range`, () => {
        const curve = CALIBRATION[name];
        for (let raw = 0; raw <= 100; raw += 5) {
          const result = calibrate(raw, curve);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(95);
        }
      });

      it(`${name}: is monotonically non-decreasing`, () => {
        const curve = CALIBRATION[name];
        let prev = calibrate(0, curve);
        for (let raw = 1; raw <= 100; raw++) {
          const current = calibrate(raw, curve);
          expect(current).toBeGreaterThanOrEqual(prev);
          prev = current;
        }
      });
    }
  });

  // ── Negative input ──

  it('handles negative raw values (below floor)', () => {
    const result = calibrate(-10, testCurve);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
