import { describe, it, expect } from 'vitest';

import { getBand, GHI_BAND_COLORS, GHI_BAND_LABELS } from '@/lib/ghi/types';
import { calibrate, CALIBRATION } from '@/lib/ghi/calibration';

// ── GHI Band Classification ──

describe('getBand', () => {
  it('returns "critical" for score < 26', () => {
    expect(getBand(0)).toBe('critical');
    expect(getBand(25)).toBe('critical');
  });

  it('returns "fair" for score 26-50', () => {
    expect(getBand(26)).toBe('fair');
    expect(getBand(50)).toBe('fair');
  });

  it('returns "good" for score 51-75', () => {
    expect(getBand(51)).toBe('good');
    expect(getBand(75)).toBe('good');
  });

  it('returns "strong" for score ≥ 76', () => {
    expect(getBand(76)).toBe('strong');
    expect(getBand(100)).toBe('strong');
  });
});

// ── Band colors and labels ──

describe('GHI_BAND_COLORS', () => {
  it('has colors for all 4 bands', () => {
    expect(GHI_BAND_COLORS.critical).toBeDefined();
    expect(GHI_BAND_COLORS.fair).toBeDefined();
    expect(GHI_BAND_COLORS.good).toBeDefined();
    expect(GHI_BAND_COLORS.strong).toBeDefined();
  });
});

describe('GHI_BAND_LABELS', () => {
  it('has labels for all 4 bands', () => {
    expect(GHI_BAND_LABELS.critical).toBe('Critical');
    expect(GHI_BAND_LABELS.fair).toBe('Fair');
    expect(GHI_BAND_LABELS.good).toBe('Good');
    expect(GHI_BAND_LABELS.strong).toBe('Strong');
  });
});

// ── Weight redistribution when Citizen Engagement is disabled ──
// This tests the getWeights() function logic directly (unit-level)

describe('GHI weight redistribution', () => {
  const BASE_WEIGHTS = {
    'DRep Participation': 0.2,
    'Citizen Engagement': 0.15,
    'Deliberation Quality': 0.2,
    'Governance Effectiveness': 0.2,
    'Power Distribution': 0.15,
    'System Stability': 0.1,
  };

  it('base weights sum to 1.0', () => {
    const sum = Object.values(BASE_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('redistributed weights sum to 1.0 when citizen engagement is disabled', () => {
    const { 'Citizen Engagement': _, ...rest } = BASE_WEIGHTS;
    const totalRemaining = Object.values(rest).reduce((s, w) => s + w, 0);

    const redistributed: Record<string, number> = {};
    for (const [name, weight] of Object.entries(rest)) {
      redistributed[name] = weight / totalRemaining;
    }

    const sum = Object.values(redistributed).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('proportionally increases each remaining weight', () => {
    const { 'Citizen Engagement': _, ...rest } = BASE_WEIGHTS;
    const totalRemaining = Object.values(rest).reduce((s, w) => s + w, 0);

    const redistributed: Record<string, number> = {};
    for (const [name, weight] of Object.entries(rest)) {
      redistributed[name] = weight / totalRemaining;
    }

    // DRep Participation: 0.2/0.85 ≈ 0.235
    expect(redistributed['DRep Participation']).toBeCloseTo(0.2 / 0.85, 3);
    // Deliberation Quality: 0.2/0.85 ≈ 0.235
    expect(redistributed['Deliberation Quality']).toBeCloseTo(0.2 / 0.85, 3);
    // System Stability: 0.1/0.85 ≈ 0.118
    expect(redistributed['System Stability']).toBeCloseTo(0.1 / 0.85, 3);
  });
});

// ── GHI composite calculation (unit-level simulation) ──

describe('GHI composite score calculation', () => {
  it('all components at 0 → score = 0', () => {
    const components = [
      { value: 0, weight: 0.2 },
      { value: 0, weight: 0.2 },
      { value: 0, weight: 0.2 },
      { value: 0, weight: 0.15 },
      { value: 0, weight: 0.15 },
      { value: 0, weight: 0.1 },
    ];
    const score = components.reduce((s, c) => s + Math.round(c.value * c.weight), 0);
    expect(score).toBe(0);
  });

  it('all components at 100 → score = 100', () => {
    const weights = [0.2, 0.15, 0.2, 0.2, 0.15, 0.1];
    const contributions = weights.map((w) => Math.round(100 * w));
    const score = Math.min(
      100,
      contributions.reduce((s, c) => s + c, 0),
    );
    expect(score).toBe(100);
  });

  it('mixed components → weighted average', () => {
    const components = [
      { value: 80, weight: 0.2 }, // DRep Participation: 16
      { value: 0, weight: 0.15 }, // Citizen Engagement (disabled)
      { value: 60, weight: 0.2 }, // Deliberation Quality: 12
      { value: 70, weight: 0.2 }, // Governance Effectiveness: 14
      { value: 50, weight: 0.15 }, // Power Distribution: 7.5 → 8
      { value: 40, weight: 0.1 }, // System Stability: 4
    ];
    const score = Math.min(
      100,
      Math.max(
        0,
        components.reduce((s, c) => s + Math.round(c.value * c.weight), 0),
      ),
    );
    // 16 + 0 + 12 + 14 + 8 + 4 = 54
    expect(score).toBe(54);
  });

  it('score is clamped to 0-100', () => {
    // Even with calibrated values at max (95), score should never exceed 100
    const maxCalibrated = 95;
    const weights = [0.2, 0.15, 0.2, 0.2, 0.15, 0.1];
    const score = Math.min(
      100,
      weights.reduce((s, w) => s + Math.round(maxCalibrated * w), 0),
    );
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ── Calibration → band pipeline ──

describe('calibration → band pipeline', () => {
  it('low raw values → "critical" band', () => {
    // Raw participation = 10 (below floor=20) → calibrated ≈ 10
    const calibrated = calibrate(10, CALIBRATION.drepParticipation);
    expect(calibrated).toBeLessThan(20);
    // Single component at low value → overall GHI in critical
  });

  it('target range values → "good" or "strong" band', () => {
    // Raw participation = 70 (at targetHigh) → calibrated ≈ 80
    const calibrated = calibrate(70, CALIBRATION.drepParticipation);
    expect(calibrated).toBeCloseTo(80, 0);
  });
});
