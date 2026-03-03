/**
 * Component calibration curves — map raw metric values to 0-100 scores
 * using piecewise linear interpolation with floor/target/ceiling thresholds.
 *
 * This prevents raw percentages from being misleading (e.g., 40% participation
 * isn't "40 out of 100" — it might actually be healthy for governance).
 */

export interface CalibrationCurve {
  floor: number;
  targetLow: number;
  targetHigh: number;
  ceiling: number;
}

/**
 * Piecewise linear calibration.
 *
 * Below floor    → 0-20  (critical)
 * Floor-targetLow  → 20-50 (fair)
 * TargetLow-targetHigh → 50-80 (good)
 * TargetHigh-ceiling  → 80-95 (strong)
 * Above ceiling   → cap at 95
 */
export function calibrate(raw: number, curve: CalibrationCurve): number {
  if (raw <= curve.floor) {
    return curve.floor === 0 ? 0 : Math.max(0, (raw / curve.floor) * 20);
  }
  if (raw <= curve.targetLow) {
    return 20 + ((raw - curve.floor) / (curve.targetLow - curve.floor)) * 30;
  }
  if (raw <= curve.targetHigh) {
    return 50 + ((raw - curve.targetLow) / (curve.targetHigh - curve.targetLow)) * 30;
  }
  if (raw <= curve.ceiling) {
    return 80 + ((raw - curve.targetHigh) / (curve.ceiling - curve.targetHigh)) * 15;
  }
  return 95;
}

// ---------------------------------------------------------------------------
// Per-component calibration targets (configurable, tune after initial data)
// ---------------------------------------------------------------------------

export const CALIBRATION = {
  drepParticipation: {
    floor: 20,
    targetLow: 40,
    targetHigh: 70,
    ceiling: 90,
  },
  citizenEngagement: {
    floor: 10,
    targetLow: 30,
    targetHigh: 60,
    ceiling: 80,
  },
  deliberationQuality: {
    floor: 15,
    targetLow: 35,
    targetHigh: 65,
    ceiling: 85,
  },
  governanceEffectiveness: {
    floor: 20,
    targetLow: 40,
    targetHigh: 70,
    ceiling: 90,
  },
  powerDistribution: {
    floor: 15,
    targetLow: 35,
    targetHigh: 65,
    ceiling: 85,
  },
  systemStability: {
    floor: 30,
    targetLow: 50,
    targetHigh: 75,
    ceiling: 90,
  },
} as const;
