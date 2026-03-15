/**
 * Percentile normalization for alignment scores.
 * Converts raw scores to percentile ranks to guarantee full distribution.
 */

export interface RawScoreRow {
  drepId: string;
  treasuryConservative: number | null;
  treasuryGrowth: number | null;
  decentralization: number | null;
  security: number | null;
  innovation: number | null;
  transparency: number | null;
}

export interface NormalizedScoreRow extends RawScoreRow {
  percentile: {
    treasuryConservative: number;
    treasuryGrowth: number;
    decentralization: number;
    security: number;
    innovation: number;
    transparency: number;
  };
}

type DimensionKey = keyof Omit<RawScoreRow, 'drepId'>;

const DIMENSIONS: DimensionKey[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

/**
 * Compute percentile ranks for each dimension across all DReps.
 * Percentile = (rank / total) * 100, rounded to integer 0-100.
 * Tied scores get the average rank.
 */
export function normalizeToPercentiles(rows: RawScoreRow[]): NormalizedScoreRow[] {
  if (rows.length === 0) return [];

  const percentiles = new Map<string, Record<DimensionKey, number>>();

  for (const dim of DIMENSIONS) {
    // Only rank DReps that have data for this dimension (skip nulls)
    const withData = rows.filter((row) => row[dim] != null);
    const sorted = withData
      .map((row) => ({ drepId: row.drepId, value: row[dim] as number }))
      .sort((a, b) => a.value - b.value);

    const nd = sorted.length;

    // Assign ranks with tie-handling (average rank for ties)
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j < sorted.length && sorted[j].value === sorted[i].value) j++;

      const avgRank = (i + j - 1) / 2; // 0-indexed average rank for this tie group
      const percentile = nd <= 1 ? 50 : Math.round((avgRank / (nd - 1)) * 100);

      for (let k = i; k < j; k++) {
        const drepId = sorted[k].drepId;
        if (!percentiles.has(drepId)) {
          percentiles.set(drepId, {} as Record<DimensionKey, number>);
        }
        percentiles.get(drepId)![dim] = percentile;
      }

      i = j;
    }

    // DReps with null for this dimension get percentile 50 (neutral)
    for (const row of rows) {
      if (row[dim] == null) {
        if (!percentiles.has(row.drepId)) {
          percentiles.set(row.drepId, {} as Record<DimensionKey, number>);
        }
        percentiles.get(row.drepId)![dim] = 50;
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    percentile: percentiles.get(row.drepId)!,
  }));
}
