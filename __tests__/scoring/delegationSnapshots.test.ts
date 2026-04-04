import { describe, expect, it } from 'vitest';
import {
  buildDelegationSnapshotInsert,
  resolveDelegatedPowerLovelace,
} from '@/lib/scoring/delegationSnapshots';
import type { DelegationSnapshotData } from '@/lib/scoring/types';

function makeHistory(
  epochs: Array<{
    epoch: number;
    delegatorCount: number;
    totalPowerLovelace?: number;
    newDelegators?: number | null;
    lostDelegators?: number | null;
  }>,
): DelegationSnapshotData {
  return {
    epochs: epochs.map((epoch) => ({
      epoch: epoch.epoch,
      delegatorCount: epoch.delegatorCount,
      totalPowerLovelace: epoch.totalPowerLovelace ?? 0,
      newDelegators: epoch.newDelegators ?? null,
      lostDelegators: epoch.lostDelegators ?? null,
    })),
  };
}

describe('buildDelegationSnapshotInsert', () => {
  it('prefers the stored lovelace value when resolving delegated power', () => {
    expect(
      resolveDelegatedPowerLovelace({
        votingPower: 123.45,
        votingPowerLovelace: '123450000',
      }),
    ).toBe(123450000);
  });

  it('converts ADA-scale voting power to lovelace when needed', () => {
    expect(
      resolveDelegatedPowerLovelace({
        votingPower: 123.45,
      }),
    ).toBe(123450000);
  });

  it('computes new and lost delegators from the latest prior epoch', () => {
    const insert = buildDelegationSnapshotInsert(
      makeHistory([{ epoch: 549, delegatorCount: 100 }]),
      550,
      112,
      999,
    );

    expect(insert).toEqual({
      epoch: 550,
      delegator_count: 112,
      total_power_lovelace: 999,
      new_delegators: 12,
      lost_delegators: 0,
    });
  });

  it('preserves current-epoch delta values on same-epoch reruns', () => {
    const insert = buildDelegationSnapshotInsert(
      makeHistory([
        { epoch: 549, delegatorCount: 100 },
        { epoch: 550, delegatorCount: 112, newDelegators: 12, lostDelegators: 0 },
      ]),
      550,
      115,
      1001,
    );

    expect(insert).toEqual({
      epoch: 550,
      delegator_count: 115,
      total_power_lovelace: 1001,
      new_delegators: 12,
      lost_delegators: 0,
    });
  });

  it('backfills missing current-epoch delta values from the latest prior epoch', () => {
    const insert = buildDelegationSnapshotInsert(
      makeHistory([
        { epoch: 549, delegatorCount: 100 },
        { epoch: 550, delegatorCount: 112, newDelegators: null, lostDelegators: null },
      ]),
      550,
      108,
      1002,
    );

    expect(insert).toEqual({
      epoch: 550,
      delegator_count: 108,
      total_power_lovelace: 1002,
      new_delegators: 8,
      lost_delegators: 0,
    });
  });

  it('recomputes delta values when finalizing an existing epoch snapshot', () => {
    const insert = buildDelegationSnapshotInsert(
      makeHistory([
        { epoch: 549, delegatorCount: 100 },
        { epoch: 550, delegatorCount: 112, newDelegators: 12, lostDelegators: 0 },
      ]),
      550,
      95,
      1003,
      { preserveExistingCurrentEpochDeltas: false },
    );

    expect(insert).toEqual({
      epoch: 550,
      delegator_count: 95,
      total_power_lovelace: 1003,
      new_delegators: 0,
      lost_delegators: 5,
    });
  });
});
