import { beforeEach, describe, expect, it, vi } from 'vitest';
import { derivePersonaFromSession } from '@/lib/governance/derivePersonaFromSession';

const mockGetSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

type MockRow = Record<string, unknown>;
type MockTable = 'users' | 'user_wallets' | 'pools' | 'cc_members';

interface MockRows {
  users?: MockRow[];
  user_wallets?: MockRow[];
  pools?: MockRow[];
  cc_members?: MockRow[];
}

function makeSupabase(rows: MockRows) {
  const normalizedRows: Record<MockTable, MockRow[]> = {
    users: rows.users ?? [],
    user_wallets: rows.user_wallets ?? [],
    pools: rows.pools ?? [],
    cc_members: rows.cc_members ?? [],
  };

  return {
    from: vi.fn((table: MockTable) => {
      let currentRows = [...normalizedRows[table]];
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          currentRows = currentRows.filter((row) => row[column] === value);
          return query;
        }),
        in: vi.fn((column: string, values: unknown[]) => {
          currentRows = currentRows.filter((row) => values.includes(row[column]));
          return query;
        }),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: currentRows[0] ?? null, error: null })),
      };
      return query;
    }),
  };
}

describe('derivePersonaFromSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves anonymous when no session exists', async () => {
    mockGetSupabaseAdmin.mockReturnValue(makeSupabase({}));

    await expect(derivePersonaFromSession(null)).resolves.toEqual({ persona: 'anonymous' });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it('resolves wallet users without claims or delegation as citizens', async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      makeSupabase({
        users: [
          {
            id: 'user1',
            wallet_address: 'addr1',
            claimed_drep_id: null,
            delegation_history: [],
          },
        ],
        user_wallets: [
          {
            stake_address: 'stake1',
            payment_address: 'addr1',
            drep_id: null,
            pool_id: null,
          },
        ],
      }),
    );

    await expect(
      derivePersonaFromSession({ userId: 'user1', walletAddress: 'stake1' }),
    ).resolves.toEqual({
      persona: 'citizen',
      delegatedDrepId: null,
    });
  });

  it('resolves delegated wallet users as citizens with delegatedDrepId', async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      makeSupabase({
        users: [
          {
            id: 'user1',
            wallet_address: 'addr1',
            claimed_drep_id: null,
            delegation_history: [],
          },
        ],
        user_wallets: [
          {
            stake_address: 'stake1',
            payment_address: 'addr1',
            drep_id: 'drep1delegated',
            pool_id: null,
          },
        ],
      }),
    );

    await expect(
      derivePersonaFromSession({ userId: 'user1', walletAddress: 'stake1' }),
    ).resolves.toEqual({
      persona: 'citizen',
      delegatedDrepId: 'drep1delegated',
    });
  });

  it('prioritizes claimed DRep persona for the wallet', async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      makeSupabase({
        users: [
          {
            id: 'user1',
            wallet_address: 'addr1',
            claimed_drep_id: 'drep1claimed',
            delegation_history: [{ drepId: 'drep1delegated' }],
          },
        ],
        user_wallets: [
          {
            stake_address: 'stake1',
            payment_address: 'addr1',
            drep_id: 'drep1delegated',
            pool_id: 'pool1claimed',
          },
        ],
      }),
    );

    await expect(
      derivePersonaFromSession({ userId: 'user1', walletAddress: 'stake1' }),
    ).resolves.toEqual({
      persona: 'drep',
      drepId: 'drep1claimed',
    });
  });

  it('resolves a claimed pool wallet as an SPO', async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      makeSupabase({
        users: [
          {
            id: 'user1',
            wallet_address: 'addr1',
            claimed_drep_id: null,
            delegation_history: [],
          },
        ],
        user_wallets: [
          {
            stake_address: 'stake1',
            payment_address: 'addr1',
            drep_id: null,
            pool_id: null,
          },
        ],
        pools: [{ pool_id: 'pool1claimed', claimed_by: 'addr1' }],
      }),
    );

    await expect(
      derivePersonaFromSession({ userId: 'user1', walletAddress: 'stake1' }),
    ).resolves.toEqual({
      persona: 'spo',
      poolId: 'pool1claimed',
    });
  });

  it('resolves a CC hot credential wallet as a CC member', async () => {
    mockGetSupabaseAdmin.mockReturnValue(
      makeSupabase({
        users: [
          {
            id: 'user1',
            wallet_address: 'cc_hot1',
            claimed_drep_id: null,
            delegation_history: [],
          },
        ],
        user_wallets: [
          {
            stake_address: 'cc_hot1',
            payment_address: 'addr1',
            drep_id: null,
            pool_id: null,
          },
        ],
        cc_members: [{ cc_hot_id: 'cc_hot1' }],
      }),
    );

    await expect(
      derivePersonaFromSession({ userId: 'user1', walletAddress: 'cc_hot1' }),
    ).resolves.toEqual({
      persona: 'cc',
      ccHotId: 'cc_hot1',
    });
  });
});
