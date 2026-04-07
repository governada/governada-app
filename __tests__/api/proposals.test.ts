import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockGetSupabaseAdmin = vi.fn();

vi.mock('@/lib/api/withRouteHandler', () => ({
  withRouteHandler:
    (handler: (request: Request, ctx: { requestId: string }) => unknown) => (request: Request) =>
      handler(request, { requestId: 'test-request' }),
}));

vi.mock('@/lib/redis', () => ({
  cached: vi.fn((_key: string, _ttl: number, loader: () => unknown) => loader()),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

import { GET } from '@/app/api/proposals/route';

function makeProposalsQuery(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return chain;
}

function makeGovernanceStatsQuery(row: Record<string, unknown>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data: row, error: null }),
  };

  return chain;
}

function makeOutcomeQuery(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return chain;
}

function makeSummaryQuery(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return chain;
}

describe('GET /api/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits proposal outcomes to the fetched proposal tx hashes and reads governance stats once', async () => {
    const proposalsQuery = makeProposalsQuery([
      {
        tx_hash: 'tx-2',
        proposal_index: 1,
        title: 'Treasury 2',
        proposal_type: 'TreasuryWithdrawals',
        expired_epoch: null,
        ratified_epoch: null,
        enacted_epoch: null,
        dropped_epoch: null,
        expiration_epoch: 401,
        proposed_epoch: 400,
        withdrawal_amount: 2_000_000_000,
        treasury_tier: 'large',
        block_time: 2_000,
        relevant_prefs: [],
      },
      {
        tx_hash: 'tx-1',
        proposal_index: 0,
        title: 'Treasury 1',
        proposal_type: 'TreasuryWithdrawals',
        expired_epoch: null,
        ratified_epoch: null,
        enacted_epoch: null,
        dropped_epoch: null,
        expiration_epoch: 400,
        proposed_epoch: 399,
        withdrawal_amount: 1_000_000_000,
        treasury_tier: 'medium',
        block_time: 1_000,
        relevant_prefs: ['devex'],
      },
    ]);
    const governanceStatsQuery = makeGovernanceStatsQuery({
      current_epoch: 390,
      treasury_balance_lovelace: 10_000_000_000,
    });
    const outcomesQuery = makeOutcomeQuery([
      {
        proposal_tx_hash: 'tx-2',
        proposal_index: 1,
        delivery_status: 'in_progress',
        delivery_score: 55,
      },
    ]);
    const summaryQuery = makeSummaryQuery([
      {
        proposal_tx_hash: 'tx-2',
        proposal_index: 1,
        drep_yes_votes_cast: 4,
        drep_no_votes_cast: 1,
        drep_abstain_votes_cast: 0,
        pool_yes_votes_cast: 0,
        pool_no_votes_cast: 0,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 0,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 0,
      },
    ]);

    const from = vi.fn((table: string) => {
      if (table === 'proposals') return proposalsQuery;
      if (table === 'governance_stats') return governanceStatsQuery;
      if (table === 'proposal_outcomes') return outcomesQuery;
      if (table === 'proposal_voting_summary') return summaryQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    mockGetSupabaseAdmin.mockReturnValue({ from });

    const response = await GET(createRequest('/api/proposals?limit=2'));
    const body = (await parseJson(response)) as {
      proposals: Array<Record<string, unknown>>;
      currentEpoch: number | null;
    };

    expect(response.status).toBe(200);
    expect(body.currentEpoch).toBe(390);
    expect(body.proposals).toHaveLength(2);
    expect(outcomesQuery.in).toHaveBeenCalledWith('proposal_tx_hash', ['tx-2', 'tx-1']);
    expect(from.mock.calls.filter(([table]) => table === 'governance_stats')).toHaveLength(1);
    expect(governanceStatsQuery.select).toHaveBeenCalledWith(
      'current_epoch, treasury_balance_lovelace',
    );
  });
});
