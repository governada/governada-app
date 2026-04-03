import type { DelegationSnapshotData } from './types';

export interface DelegationSnapshotInsert {
  epoch: number;
  delegator_count: number;
  total_power_lovelace: number;
  new_delegators: number | null;
  lost_delegators: number | null;
}

/**
 * Build an idempotent delegation snapshot row for the current epoch.
 *
 * If a current-epoch row already exists, preserve its new/lost delegator
 * values. Otherwise compute them against the latest prior epoch.
 */
export function buildDelegationSnapshotInsert(
  snapshotHistory: DelegationSnapshotData | undefined,
  currentEpoch: number,
  delegatorCount: number,
  totalPowerLovelace: number,
): DelegationSnapshotInsert {
  const epochs = snapshotHistory?.epochs ?? [];
  const currentEpochSnapshot = [...epochs].reverse().find((epoch) => epoch.epoch === currentEpoch);
  const priorEpochSnapshot = [...epochs].reverse().find((epoch) => epoch.epoch < currentEpoch);

  let newDelegators = currentEpochSnapshot?.newDelegators ?? null;
  let lostDelegators = currentEpochSnapshot?.lostDelegators ?? null;

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
    epoch: currentEpoch,
    delegator_count: delegatorCount,
    total_power_lovelace: totalPowerLovelace,
    new_delegators: newDelegators,
    lost_delegators: lostDelegators,
  };
}
