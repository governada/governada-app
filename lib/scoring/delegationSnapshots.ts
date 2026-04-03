import type { DelegationSnapshotData } from './types';

export interface DelegationSnapshotInsert {
  epoch: number;
  delegator_count: number;
  total_power_lovelace: number;
  new_delegators: number | null;
  lost_delegators: number | null;
}

interface BuildDelegationSnapshotOptions {
  preserveExistingCurrentEpochDeltas?: boolean;
}

/**
 * Build an idempotent delegation snapshot row for a target epoch.
 *
 * By default, reruns for the same epoch preserve any existing delta fields.
 * Finalization callers can disable that behavior and recompute the deltas
 * against the latest prior epoch instead.
 */
export function buildDelegationSnapshotInsert(
  snapshotHistory: DelegationSnapshotData | undefined,
  targetEpoch: number,
  delegatorCount: number,
  totalPowerLovelace: number,
  options: BuildDelegationSnapshotOptions = {},
): DelegationSnapshotInsert {
  const epochs = snapshotHistory?.epochs ?? [];
  const currentEpochSnapshot = [...epochs].reverse().find((epoch) => epoch.epoch === targetEpoch);
  const priorEpochSnapshot = [...epochs].reverse().find((epoch) => epoch.epoch < targetEpoch);
  const preserveExistingCurrentEpochDeltas = options.preserveExistingCurrentEpochDeltas ?? true;

  let newDelegators = preserveExistingCurrentEpochDeltas
    ? currentEpochSnapshot?.newDelegators ?? null
    : null;
  let lostDelegators = preserveExistingCurrentEpochDeltas
    ? currentEpochSnapshot?.lostDelegators ?? null
    : null;

  if ((newDelegators == null || lostDelegators == null) && priorEpochSnapshot) {
    const diff = delegatorCount - priorEpochSnapshot.delegatorCount;
    const computedNewDelegators = diff >= 0 ? diff : 0;
    const computedLostDelegators = diff >= 0 ? 0 : Math.abs(diff);

    if (newDelegators == null) {
      newDelegators = computedNewDelegators;
    }
    if (lostDelegators == null) {
      lostDelegators = computedLostDelegators;
    }
  }

  return {
    epoch: targetEpoch,
    delegator_count: delegatorCount,
    total_power_lovelace: totalPowerLovelace,
    new_delegators: newDelegators,
    lost_delegators: lostDelegators,
  };
}
