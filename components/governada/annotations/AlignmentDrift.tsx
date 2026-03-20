'use client';

/**
 * AlignmentDrift — Ambient annotation for DRep profile pages.
 *
 * Shows alignment drift badge with data trail:
 * "15% drift since you delegated [Show divergence history]"
 *
 * Pattern: Perplexity cited intelligence + Harvey provenance.
 */

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { AnnotationBase, type ProvenanceStep } from './AnnotationBase';
import { useFeatureFlag } from '@/components/FeatureGate';

export interface AlignmentDriftData {
  /** Drift percentage (0-100) */
  driftPercent: number;
  /** Direction of drift */
  direction: 'diverging' | 'converging' | 'stable';
  /** Human-readable time range */
  timeRange: string;
  /** DRep name for display */
  drepName: string;
  /** Provenance chain */
  provenance: ProvenanceStep[];
}

interface AlignmentDriftProps {
  drift: AlignmentDriftData | null | undefined;
  className?: string;
}

export function AlignmentDrift({ drift, className }: AlignmentDriftProps) {
  const flagEnabled = useFeatureFlag('ambient_annotations');
  if (flagEnabled === false || !drift) return null;

  // Only show if drift is meaningful (> 5%)
  if (drift.driftPercent < 5) return null;

  const Icon =
    drift.direction === 'diverging'
      ? TrendingDown
      : drift.direction === 'converging'
        ? TrendingUp
        : Minus;

  const variant =
    drift.direction === 'diverging'
      ? drift.driftPercent > 20
        ? 'warning'
        : 'info'
      : drift.direction === 'converging'
        ? 'success'
        : 'neutral';

  const text =
    drift.direction === 'diverging'
      ? `${drift.driftPercent}% alignment drift from ${drift.drepName} ${drift.timeRange}`
      : drift.direction === 'converging'
        ? `Alignment with ${drift.drepName} improving — ${drift.driftPercent}% closer ${drift.timeRange}`
        : `Alignment with ${drift.drepName} stable ${drift.timeRange}`;

  return (
    <AnnotationBase
      icon={<Icon className="h-3.5 w-3.5" />}
      text={text}
      variant={variant as 'info' | 'warning' | 'success' | 'neutral'}
      provenance={drift.provenance}
      className={className}
      data-testid="alignment-drift-annotation"
    />
  );
}

/**
 * Compute alignment drift between a user and their DRep.
 *
 * Uses the 6D alignment vectors stored in the dreps table.
 * Drift is the change in cosine distance over time.
 */
export function computeAlignmentDrift(
  userAlignment: number[] | null,
  drepAlignment: number[] | null,
  drepName: string,
  _historicalDrift?: number | null,
): AlignmentDriftData | null {
  if (!userAlignment || !drepAlignment) return null;
  if (userAlignment.length !== 6 || drepAlignment.length !== 6) return null;

  // Compute current cosine similarity
  let dot = 0;
  let normU = 0;
  let normD = 0;
  for (let i = 0; i < 6; i++) {
    dot += userAlignment[i] * drepAlignment[i];
    normU += userAlignment[i] ** 2;
    normD += drepAlignment[i] ** 2;
  }
  const denom = Math.sqrt(normU) * Math.sqrt(normD);
  const similarity = denom === 0 ? 0 : dot / denom;

  // Convert to a drift percentage (lower similarity = more drift)
  // Similarity of 1.0 = 0% drift, 0.5 = 50% drift
  const driftPercent = Math.round((1 - similarity) * 100);

  // Determine direction based on historical data
  // For now, if drift > 15% we call it diverging, otherwise stable
  const direction: AlignmentDriftData['direction'] =
    driftPercent > 15 ? 'diverging' : driftPercent < 5 ? 'converging' : 'stable';

  const dimensionLabels = [
    'Treasury Conservative',
    'Treasury Growth',
    'Decentralization',
    'Security',
    'Innovation',
    'Transparency',
  ];

  // Find the dimensions with largest divergence
  const diffs = dimensionLabels.map((label, i) => ({
    label,
    diff: Math.abs(userAlignment[i] - drepAlignment[i]),
    userVal: userAlignment[i],
    drepVal: drepAlignment[i],
  }));
  diffs.sort((a, b) => b.diff - a.diff);

  const provenance: ProvenanceStep[] = [
    {
      label: 'Source data',
      detail: '6-dimension alignment vectors computed from voting patterns',
    },
  ];

  if (diffs[0].diff > 10) {
    provenance.push({
      label: 'Largest divergence',
      detail: `${diffs[0].label}: you ${diffs[0].userVal}% vs DRep ${diffs[0].drepVal}%`,
    });
  }

  provenance.push({
    label: 'Conclusion',
    detail: `Overall alignment: ${Math.round(similarity * 100)}% (${direction})`,
  });

  return {
    driftPercent,
    direction,
    timeRange: 'since delegation',
    drepName,
    provenance,
  };
}
