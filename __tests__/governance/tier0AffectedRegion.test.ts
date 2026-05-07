import { describe, expect, it } from 'vitest';
import { proposalNodeId, resolveTier0AffectedRegion } from '@/lib/governance/tier0AffectedRegion';
import type { Tier0Trigger } from '@/types/cinematic';

type TableRows = Record<string, Array<Record<string, unknown>>>;

function fakeSupabase(rows: TableRows) {
  return {
    from<T = Record<string, unknown>>(table: string) {
      const filters: Array<{ column: string; value: string | number }> = [];
      const inFilters: Array<{ column: string; values: string[] }> = [];
      const query = {
        eq: (column: string, value: string | number) => {
          filters.push({ column, value });
          return query;
        },
        in: (column: string, values: string[]) => {
          inFilters.push({ column, values });
          return query;
        },
        then: <
          TResult1 = { data: T[] | null; error: { message: string } | null },
          TResult2 = never,
        >(
          onfulfilled?:
            | ((value: {
                data: T[] | null;
                error: { message: string } | null;
              }) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) =>
          Promise.resolve({
            data: (rows[table] ?? []).filter(
              (row) =>
                filters.every((filter) => row[filter.column] === filter.value) &&
                inFilters.every((filter) => filter.values.includes(String(row[filter.column]))),
            ) as T[],
            error: null,
          }).then(onfulfilled, onrejected),
      };
      return { select: () => query };
    },
  };
}

function trigger(
  overrides: Partial<Tier0Trigger & { removedCcHotIds: string[] }> = {},
): Tier0Trigger & { removedCcHotIds?: string[] } {
  return {
    id: 'no-confidence:abcdef1234567890:0',
    type: 'no_confidence_ratified',
    proposalTxHash: 'abcdef1234567890',
    proposalIndex: 0,
    proposalType: 'NoConfidence',
    eventEpoch: 100,
    decayHours: 168,
    ...overrides,
  };
}

describe('resolveTier0AffectedRegion', () => {
  it('returns voters plus proposal node for ordinary Tier 0 triggers', async () => {
    const region = await resolveTier0AffectedRegion(
      trigger({ type: 'hard_fork_enacted', proposalType: 'HardForkInitiation' }),
      fakeSupabase({
        drep_votes: [
          {
            proposal_tx_hash: 'abcdef1234567890',
            proposal_index: 0,
            drep_id: 'drep1abcdefghijklmnop',
          },
        ],
        spo_votes: [
          {
            proposal_tx_hash: 'abcdef1234567890',
            proposal_index: 0,
            pool_id: 'pool1abcdefghijklmnop',
          },
        ],
        cc_votes: [
          {
            proposal_tx_hash: 'abcdef1234567890',
            proposal_index: 0,
            cc_hot_id: 'cc1abcdefghijklmnop',
          },
        ],
      }),
    );

    expect(region.affectedNodeIds).toEqual(
      new Set([
        proposalNodeId('abcdef1234567890', 0),
        'drep1abcdefghijk',
        'pool1abcdefghijk',
        'cc1abcdefghijklm',
      ]),
    );
  });

  it('adds removed CC member nodes for no-confidence Tier 0 triggers', async () => {
    const region = await resolveTier0AffectedRegion(
      trigger({ removedCcHotIds: ['cc_removed_abcdefghijklmnop'] }),
      fakeSupabase({
        drep_votes: [],
        spo_votes: [],
        cc_votes: [],
        cc_members: [],
      }),
    );

    expect(region.affectedNodeIds).toContain('cc_removed_abcde');
    expect(region.nonVoterDim).toBe(0.3);
    expect(region.spectatorDim).toBe(0.5);
  });
});
