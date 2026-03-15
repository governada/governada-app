/**
 * Independence verification — checks correlation between the 6 visual dimensions.
 * Flags any pair with |r| > 0.7 as they're measuring the same thing.
 */

import type { NormalizedScoreRow } from './normalize';
import { logger } from '@/lib/logger';

export interface CorrelationResult {
  dim1: string;
  dim2: string;
  correlation: number;
  isFlagged: boolean;
}

export interface ValidationReport {
  correlations: CorrelationResult[];
  flaggedPairs: CorrelationResult[];
  allIndependent: boolean;
  timestamp: string;
}

type DimensionKey =
  | 'treasuryConservative'
  | 'treasuryGrowth'
  | 'decentralization'
  | 'security'
  | 'innovation'
  | 'transparency';

const DIMENSIONS: DimensionKey[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

const CORRELATION_THRESHOLD = 0.7;

/**
 * Compute Pearson correlation between two arrays.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  return denom === 0 ? 0 : sumXY / denom;
}

/**
 * Validate dimension independence by computing all pairwise correlations.
 * Uses raw scores (not percentiles) for meaningful correlation analysis.
 */
export function validateDimensionIndependence(rows: NormalizedScoreRow[]): ValidationReport {
  const correlations: CorrelationResult[] = [];
  const flaggedPairs: CorrelationResult[] = [];

  for (let i = 0; i < DIMENSIONS.length; i++) {
    for (let j = i + 1; j < DIMENSIONS.length; j++) {
      const dim1 = DIMENSIONS[i];
      const dim2 = DIMENSIONS[j];

      const x = rows.map((r) => r[dim1] ?? 50);
      const y = rows.map((r) => r[dim2] ?? 50);

      const r = pearsonCorrelation(x, y);
      const result: CorrelationResult = {
        dim1,
        dim2,
        correlation: Math.round(r * 1000) / 1000,
        isFlagged: Math.abs(r) > CORRELATION_THRESHOLD,
      };

      correlations.push(result);
      if (result.isFlagged) {
        flaggedPairs.push(result);
      }
    }
  }

  const report: ValidationReport = {
    correlations,
    flaggedPairs,
    allIndependent: flaggedPairs.length === 0,
    timestamp: new Date().toISOString(),
  };

  if (flaggedPairs.length > 0) {
    logger.warn('[alignment:validate] Correlated dimension pairs found', {
      count: flaggedPairs.length,
      pairs: flaggedPairs.map((p) => `${p.dim1}↔${p.dim2}: r=${p.correlation}`),
    });
  } else {
    logger.info('[alignment:validate] All 6 dimensions are sufficiently independent');
  }

  return report;
}
