/**
 * Edinburgh Decentralization Index (EDI) — 7 metrics applied to governance voting power.
 *
 * All functions are pure math: input is a number[] of resource shares (voting power),
 * output is a single number. No DB access, fully testable.
 *
 * Reference: Edinburgh Decentralization Index methodology paper.
 */

// ---------------------------------------------------------------------------
// Individual metrics
// ---------------------------------------------------------------------------

/**
 * Minimum number of entities controlling > threshold (default 50%) of total resources.
 * Higher = more decentralized.
 */
export function nakamoto(values: number[], threshold = 0.5): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i];
    if (cumulative / total > threshold) return i + 1;
  }
  return sorted.length;
}

/**
 * Gini coefficient: 0 = perfect equality, 1 = one entity has all.
 * Lower = more decentralized.
 */
export function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  let sumOfAbsDiffs = 0;
  for (let i = 0; i < n; i++) {
    sumOfAbsDiffs += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return sumOfAbsDiffs / (n * total);
}

/**
 * Shannon entropy normalized to 0-1. Higher = more decentralized.
 * H = -sum(p_i * log2(p_i)) / log2(n)
 */
export function shannonEntropy(values: number[]): number {
  if (values.length <= 1) return 0;
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const v of values) {
    if (v <= 0) continue;
    const p = v / total;
    entropy -= p * Math.log2(p);
  }
  return entropy / Math.log2(values.length);
}

/**
 * Herfindahl-Hirschman Index: sum(share_i^2) * 10000.
 * Lower = more competitive/decentralized. Range: 10000/n to 10000.
 */
export function hhi(values: number[]): number {
  if (values.length === 0) return 10000;
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 10000;

  let sum = 0;
  for (const v of values) {
    const share = v / total;
    sum += share * share;
  }
  return Math.round(sum * 10000);
}

/**
 * Theil Index: (1/n) * sum((x_i / mean) * ln(x_i / mean)).
 * 0 = perfect equality. Higher = more concentrated.
 */
export function theilIndex(values: number[]): number {
  const filtered = values.filter((v) => v > 0);
  if (filtered.length === 0) return 0;
  const n = filtered.length;
  const mean = filtered.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  let t = 0;
  for (const v of filtered) {
    const ratio = v / mean;
    t += ratio * Math.log(ratio);
  }
  return t / n;
}

/**
 * 1 - Concentration Ratio: 1 - (top entity / total).
 * Higher = less concentrated = more decentralized.
 */
export function oneMinusConcentration(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const max = Math.max(...values);
  return 1 - max / total;
}

/**
 * Tau-Decentralization Index: minimum entities controlling > threshold (default 66%).
 * Supermajority variant of Nakamoto — relevant to Cardano governance thresholds.
 */
export function tauDecentralization(values: number[], threshold = 0.66): number {
  return nakamoto(values, threshold);
}

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

const METRIC_WEIGHTS = {
  nakamoto: 0.2,
  gini: 0.15,
  shannonEntropy: 0.2,
  hhi: 0.15,
  theil: 0.1,
  concentration: 0.1,
  tau: 0.1,
} as const;

export interface EDIBreakdown {
  nakamotoCoefficient: number;
  gini: number;
  shannonEntropy: number;
  hhi: number;
  theilIndex: number;
  concentrationRatio: number;
  tauDecentralization: number;
}

export interface EDIResult {
  compositeScore: number;
  breakdown: EDIBreakdown;
  normalized: Record<keyof typeof METRIC_WEIGHTS, number>;
}

/**
 * Compute the full EDI composite score (0-100) from a voting power distribution.
 * Normalizes each metric to 0-1 (inverting "lower is better" metrics), then weighted average.
 */
export function computeEDI(votingPowers: number[]): EDIResult {
  const nk = nakamoto(votingPowers);
  const gi = gini(votingPowers);
  const se = shannonEntropy(votingPowers);
  const h = hhi(votingPowers);
  const th = theilIndex(votingPowers);
  const cr = oneMinusConcentration(votingPowers);
  const td = tauDecentralization(votingPowers);

  const n = votingPowers.filter((v) => v > 0).length;

  // Normalize each to 0-1 where higher = more decentralized
  const normalized = {
    nakamoto: n > 1 ? Math.min(1, (nk - 1) / (n * 0.5 - 1)) : 0,
    gini: 1 - gi,
    shannonEntropy: se,
    hhi: n > 0 ? Math.min(1, Math.max(0, (10000 - h) / (10000 - 10000 / n))) : 0,
    theil: Math.max(0, 1 - th / Math.log(n || 1)),
    concentration: cr,
    tau: n > 1 ? Math.min(1, (td - 1) / (n * 0.5 - 1)) : 0,
  };

  const compositeScore = Math.round(
    Object.entries(METRIC_WEIGHTS).reduce(
      (score, [key, weight]) => score + normalized[key as keyof typeof METRIC_WEIGHTS] * weight,
      0,
    ) * 100,
  );

  return {
    compositeScore: Math.min(100, Math.max(0, compositeScore)),
    breakdown: {
      nakamotoCoefficient: nk,
      gini: Math.round(gi * 1000) / 1000,
      shannonEntropy: Math.round(se * 1000) / 1000,
      hhi: h,
      theilIndex: Math.round(th * 1000) / 1000,
      concentrationRatio: Math.round(cr * 1000) / 1000,
      tauDecentralization: td,
    },
    normalized,
  };
}
