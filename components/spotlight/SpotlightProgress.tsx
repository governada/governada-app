'use client';

import type { SpotlightEntityType, QueueSort } from './types';

interface SpotlightProgressProps {
  current: number;
  total: number;
  entityType: SpotlightEntityType;
  sort: QueueSort;
}

const ENTITY_LABELS: Record<SpotlightEntityType, string> = {
  drep: 'DReps',
  spo: 'Stake Pools',
  proposal: 'Proposals',
};

const SORT_LABELS: Record<QueueSort, string> = {
  score: 'Highest scoring first',
  match: 'Best match first',
  recency: 'Most recent first',
};

/**
 * Progress indicator: "3 of 247 DReps · Highest scoring first"
 */
export function SpotlightProgress({ current, total, entityType, sort }: SpotlightProgressProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="tabular-nums font-medium">
        {current + 1} of {total} {ENTITY_LABELS[entityType]}
      </span>
      <span className="text-border">·</span>
      <span>{SORT_LABELS[sort]}</span>
    </div>
  );
}
