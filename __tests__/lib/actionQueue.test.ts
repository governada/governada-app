import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock('@/lib/data', () => ({
  getOpenProposalsForDRep: vi.fn(),
  getDRepById: vi.fn(),
}));

vi.mock('@/lib/koios', () => ({
  blockTimeToEpoch: vi.fn(() => 100),
}));

import { getActionQueue } from '@/lib/actionQueue';

function makeQuery<T>(result: T) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
  };

  return chain;
}

describe('action queue SPO eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters SPO pending proposals through shared voting-body rules', async () => {
    const spoVotesQuery = {
      select: vi.fn(() => spoVotesQuery),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const proposalsQuery: any = {
      select: vi.fn(() => proposalsQuery),
      is: vi.fn(() => proposalsQuery),
    };

    proposalsQuery.is
      .mockImplementationOnce(() => proposalsQuery)
      .mockImplementationOnce(() => proposalsQuery)
      .mockImplementationOnce(() => proposalsQuery)
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: [
            {
              tx_hash: 'security-1',
              proposal_index: 0,
              title: 'Security parameter update',
              proposal_type: 'ParameterChange',
              expiration_epoch: 101,
              param_changes: { maxTxSize: 16384 },
            },
            {
              tx_hash: 'governance-1',
              proposal_index: 0,
              title: 'Governance parameter update',
              proposal_type: 'ParameterChange',
              expiration_epoch: 101,
              param_changes: { govActionLifetime: 8 },
            },
            {
              tx_hash: 'info-1',
              proposal_index: 0,
              title: 'Info action',
              proposal_type: 'InfoAction',
              expiration_epoch: 105,
              param_changes: null,
            },
            {
              tx_hash: 'treasury-1',
              proposal_index: 0,
              title: 'Treasury withdrawal',
              proposal_type: 'TreasuryWithdrawals',
              expiration_epoch: 105,
              param_changes: null,
            },
          ],
          error: null,
        }),
      );

    const poolQuery = makeQuery({ governance_score: 72 });

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'spo_votes') return spoVotesQuery;
        if (table === 'proposals') return proposalsQuery;
        if (table === 'pools') return poolQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const items = await getActionQueue('spo', { poolId: 'pool1xyz' });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spo-urgent',
          title: '1 proposal expiring soon',
        }),
        expect.objectContaining({
          id: 'spo-pending',
          title: '1 governance proposal need your vote',
        }),
      ]),
    );
    expect(items).toHaveLength(2);
  });

  it('counts only CC-votable proposals for the CC queue', async () => {
    const proposalsQuery: any = {
      select: vi.fn(() => proposalsQuery),
      is: vi.fn(() => proposalsQuery),
    };

    proposalsQuery.is
      .mockImplementationOnce(() => proposalsQuery)
      .mockImplementationOnce(() => proposalsQuery)
      .mockImplementationOnce(() => proposalsQuery)
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: [
            { proposal_type: 'TreasuryWithdrawals', param_changes: null },
            { proposal_type: 'NoConfidence', param_changes: null },
            { proposal_type: 'InfoAction', param_changes: null },
            { proposal_type: 'NewCommittee', param_changes: null },
          ],
          error: null,
        }),
      );

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'proposals') return proposalsQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const items = await getActionQueue('cc');

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cc-open-proposals',
          title: '2 proposals awaiting governance votes',
        }),
      ]),
    );
  });
});
