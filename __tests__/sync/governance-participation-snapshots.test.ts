import { describe, expect, it } from 'vitest';
import {
  backfillMissingGovernanceParticipationSnapshots,
  ensureGovernanceParticipationSnapshot,
} from '@/lib/sync/governanceParticipationSnapshots';

type QueryError = { message: string } | null;
type QueryResponse = { count?: number | null; data: unknown[] | null; error: QueryError };
type MaybeSingleResponse = { data: Record<string, unknown> | null; error: QueryError };
type DrepInfoFixture = { id?: string; info: Record<string, unknown> | null };
type VoteFixture = { drep_id: string | null; has_rationale: boolean };
type UpsertRecord = { payload: Record<string, unknown>; table: string };

type FakeState = {
  completenessInsertError?: string;
  drepInfoRows?: DrepInfoFixture[];
  existingEpochs: Set<number>;
  snapshotInsertError?: string;
  totalDreps: number;
  upserts: UpsertRecord[];
  votesByEpoch: Map<number, VoteFixture[]>;
};

class FakeSelectBuilder {
  private readonly filters = new Map<string, unknown>();

  constructor(
    private readonly state: FakeState,
    private readonly table: string,
    private readonly columns: string,
    private readonly options?: { count?: string; head?: boolean },
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.set(column, value);
    return this;
  }

  not(): this {
    return this;
  }

  async maybeSingle(): Promise<MaybeSingleResponse> {
    if (this.table !== 'governance_participation_snapshots') {
      return { data: null, error: null };
    }

    const epoch = Number(this.filters.get('epoch'));
    return {
      data: this.state.existingEpochs.has(epoch)
        ? {
            active_drep_count: 2,
            epoch,
            participation_rate: 50,
            rationale_rate: 66.67,
            total_drep_count: 4,
            total_voting_power_lovelace: '1200',
          }
        : null,
      error: null,
    };
  }

  async range(from: number, to: number): Promise<QueryResponse> {
    if (this.table !== 'dreps' || !this.columns.includes('info')) {
      return { data: [], error: null };
    }

    const rows =
      this.state.drepInfoRows?.map((row, index) => ({
        id: row.id ?? `drep${index + 1}`,
        info: row.info,
      })) ??
      Array.from({ length: this.state.totalDreps }, (_, index) => ({
        id: `drep${index + 1}`,
        info: { votingPowerLovelace: String((index + 1) * 100) },
      }));
    return { data: rows.slice(from, to + 1), error: null };
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private async resolve(): Promise<QueryResponse> {
    if (this.table === 'dreps' && this.options?.head) {
      return { count: this.state.totalDreps, data: null, error: null };
    }

    if (this.table === 'drep_votes') {
      const epoch = Number(this.filters.get('epoch_no'));
      const votes = this.state.votesByEpoch.get(epoch) ?? [];

      if (this.columns === 'vote_tx_hash') {
        return {
          count: votes.filter((vote) => vote.has_rationale).length,
          data: null,
          error: null,
        };
      }

      return {
        data: votes.map((vote) => ({ drep_id: vote.drep_id })),
        error: null,
      };
    }

    return { data: null, error: null };
  }
}

function createFakeSupabase(options: {
  completenessInsertError?: string;
  drepInfoRows?: Array<Record<string, unknown> | null>;
  existingEpochs?: number[];
  snapshotInsertError?: string;
  totalDreps?: number;
  votesByEpoch?: Record<number, VoteFixture[]>;
}) {
  const state: FakeState = {
    completenessInsertError: options.completenessInsertError,
    drepInfoRows: options.drepInfoRows?.map((info, index) => ({
      id:
        info && typeof info.id === 'string'
          ? info.id
          : typeof info?.drepId === 'string'
            ? info.drepId
            : `drep${index + 1}`,
      info,
    })),
    existingEpochs: new Set(options.existingEpochs ?? []),
    snapshotInsertError: options.snapshotInsertError,
    totalDreps: options.totalDreps ?? 4,
    upserts: [],
    votesByEpoch: new Map(
      Object.entries(options.votesByEpoch ?? {}).map(([epoch, votes]) => [Number(epoch), votes]),
    ),
  };

  const client = {
    from(table: string) {
      return {
        select(columns: string, queryOptions?: { count?: string; head?: boolean }) {
          return new FakeSelectBuilder(state, table, columns, queryOptions);
        },
        async upsert(payload: Record<string, unknown>) {
          if (table === 'governance_participation_snapshots' && state.snapshotInsertError) {
            return { error: { message: state.snapshotInsertError } };
          }
          if (table === 'snapshot_completeness_log' && state.completenessInsertError) {
            return { error: { message: state.completenessInsertError } };
          }

          state.upserts.push({ payload, table });
          if (table === 'governance_participation_snapshots' && typeof payload.epoch === 'number') {
            state.existingEpochs.add(payload.epoch);
          }
          return { error: null };
        },
      };
    },
  } as unknown as Parameters<typeof ensureGovernanceParticipationSnapshot>[0];

  return { client, state };
}

describe('governance participation snapshot helpers', () => {
  it('creates a missing participation snapshot from source vote and DRep data', async () => {
    const { client, state } = createFakeSupabase({
      drepInfoRows: [
        { votingPowerLovelace: '100' },
        { votingPowerLovelace: '200', isActive: true },
        { votingPowerLovelace: '300', isActive: false },
        { votingPowerLovelace: '400' },
        { votingPowerLovelace: '500' },
      ],
      votesByEpoch: {
        628: [
          { drep_id: 'drep1', has_rationale: true },
          { drep_id: 'drep1', has_rationale: false },
          { drep_id: 'drep2', has_rationale: true },
          { drep_id: 'drep3', has_rationale: true },
          { drep_id: 'missing-drep', has_rationale: true },
        ],
      },
    });

    const result = await ensureGovernanceParticipationSnapshot(client, 628);
    const snapshotUpsert = state.upserts.find(
      (upsert) => upsert.table === 'governance_participation_snapshots',
    );

    expect(result).toMatchObject({
      activeDreps: 2,
      epoch: 628,
      inserted: true,
      participationRate: 50,
      rationaleRate: 80,
      skipped: false,
      totalDreps: 4,
      totalVotingPowerLovelace: '1200',
    });
    expect(snapshotUpsert?.payload).toMatchObject({
      active_drep_count: 2,
      epoch: 628,
      participation_rate: 50,
      rationale_rate: 80,
      total_drep_count: 4,
      total_voting_power_lovelace: '1200',
    });
    expect(state.upserts.some((upsert) => upsert.table === 'snapshot_completeness_log')).toBe(true);
  });

  it('throws instead of swallowing participation snapshot write failures', async () => {
    const { client } = createFakeSupabase({
      snapshotInsertError: 'permission denied',
      votesByEpoch: {
        628: [{ drep_id: 'drep1', has_rationale: true }],
      },
    });

    await expect(ensureGovernanceParticipationSnapshot(client, 628)).rejects.toThrow(
      'governance_participation_snapshots upsert: permission denied',
    );
  });

  it('repairs completeness log when the snapshot already exists', async () => {
    const { client, state } = createFakeSupabase({
      existingEpochs: [628],
    });

    const result = await ensureGovernanceParticipationSnapshot(client, 628);

    expect(result).toMatchObject({
      epoch: 628,
      inserted: false,
      participationRate: 50,
      skipped: true,
    });
    expect(
      state.upserts.some((upsert) => upsert.table === 'governance_participation_snapshots'),
    ).toBe(false);
    expect(state.upserts).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          epoch_no: 628,
          metadata: { participation_rate: 50 },
          snapshot_type: 'governance_participation',
        }),
        table: 'snapshot_completeness_log',
      }),
    );
  });

  it('throws when retrying an existing snapshot cannot repair completeness log', async () => {
    const { client } = createFakeSupabase({
      completenessInsertError: 'write blocked',
      existingEpochs: [628],
    });

    await expect(ensureGovernanceParticipationSnapshot(client, 628)).rejects.toThrow(
      'snapshot_completeness_log governance_participation upsert: write blocked',
    );
  });

  it('backfills a bounded finalized-epoch window and skips existing rows', async () => {
    const { client } = createFakeSupabase({
      existingEpochs: [627],
      votesByEpoch: {
        626: [{ drep_id: 'drep1', has_rationale: true }],
        628: [{ drep_id: 'drep2', has_rationale: false }],
      },
    });

    const result = await backfillMissingGovernanceParticipationSnapshots(client, 626, 628);

    expect(result).toMatchObject({
      fromEpoch: 626,
      inserted: 2,
      skipped: 1,
      toEpoch: 628,
    });
  });
});
