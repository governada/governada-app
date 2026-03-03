import type { ScoreSnapshot } from '@/lib/data';

const PILLAR_KEYS = [
  'effectiveParticipation',
  'rationaleRate',
  'reliabilityScore',
  'profileCompleteness',
] as const;
type PillarKey = (typeof PILLAR_KEYS)[number];

const PILLAR_LABELS: Record<PillarKey, string> = {
  effectiveParticipation: 'Participation',
  rationaleRate: 'Rationale',
  reliabilityScore: 'Reliability',
  profileCompleteness: 'Profile',
};

const PILLAR_WEIGHTS: Record<PillarKey, number> = {
  effectiveParticipation: 0.3,
  rationaleRate: 0.35,
  reliabilityScore: 0.2,
  profileCompleteness: 0.15,
};

export interface PillarDiff {
  key: PillarKey;
  label: string;
  prev: number;
  curr: number;
  rawDelta: number;
  weightedDelta: number;
}

export interface DayAttribution {
  date: string;
  totalDelta: number;
  pillars: PillarDiff[];
  summary: string;
  isSignificant: boolean;
}

/**
 * Compute per-day score attribution from consecutive snapshots.
 * For each pair of days, calculates the per-pillar raw delta and weighted
 * contribution to the total score change.
 */
export function getScoreAttribution(history: ScoreSnapshot[]): DayAttribution[] {
  if (history.length < 2) return [];

  const attributions: DayAttribution[] = [];

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    const totalDelta = curr.score - prev.score;

    const pillars: PillarDiff[] = PILLAR_KEYS.map((key) => {
      const rawDelta = curr[key] - prev[key];
      return {
        key,
        label: PILLAR_LABELS[key],
        prev: prev[key],
        curr: curr[key],
        rawDelta,
        weightedDelta: Math.round(rawDelta * PILLAR_WEIGHTS[key] * 10) / 10,
      };
    });

    const movers = pillars
      .filter((p) => Math.abs(p.weightedDelta) >= 0.5)
      .sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta));

    const summary =
      movers.length === 0
        ? 'No significant change'
        : movers
            .map((p) => `${p.label} ${p.weightedDelta > 0 ? '+' : ''}${p.weightedDelta.toFixed(1)}`)
            .join(', ');

    attributions.push({
      date: curr.date,
      totalDelta,
      pillars,
      summary,
      isSignificant: Math.abs(totalDelta) >= 3,
    });
  }

  return attributions;
}
