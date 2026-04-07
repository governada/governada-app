import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProposalListPage } from '@/lib/governance/proposalList';

function makeProposalsNewestQuery(rows: Array<Record<string, unknown>>, count = rows.length) {
  const chain = {
    select: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn().mockResolvedValue({ data: rows, error: null, count }),
  };

  return chain;
}

function makeProposalsBroadQuery(rows: Array<Record<string, unknown>>, count = rows.length) {
  const chain = {
    select: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn().mockResolvedValue({ data: rows, error: null, count }),
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

describe('fetchProposalListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses paged proposal reads for newest sort and only fetches page summaries', async () => {
    const proposalsQuery = makeProposalsNewestQuery(
      [
        {
          tx_hash: 'tx-2',
          proposal_index: 1,
          title: 'Second proposal',
          abstract: null,
          ai_summary: null,
          proposal_type: 'InfoAction',
          withdrawal_amount: null,
          treasury_tier: null,
          relevant_prefs: [],
          proposed_epoch: 12,
          block_time: 2_000,
          ratified_epoch: null,
          enacted_epoch: null,
          dropped_epoch: null,
          expired_epoch: null,
          expiration_epoch: 30,
          param_changes: null,
        },
        {
          tx_hash: 'tx-1',
          proposal_index: 0,
          title: 'First proposal',
          abstract: null,
          ai_summary: null,
          proposal_type: 'InfoAction',
          withdrawal_amount: null,
          treasury_tier: null,
          relevant_prefs: [],
          proposed_epoch: 11,
          block_time: 1_000,
          ratified_epoch: null,
          enacted_epoch: null,
          dropped_epoch: null,
          expired_epoch: null,
          expiration_epoch: 29,
          param_changes: null,
        },
      ],
      20,
    );
    const summaryQuery = makeSummaryQuery([
      {
        proposal_tx_hash: 'tx-2',
        proposal_index: 1,
        drep_yes_votes_cast: 5,
        drep_no_votes_cast: 1,
        drep_abstain_votes_cast: 0,
        pool_yes_votes_cast: 0,
        pool_no_votes_cast: 0,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 0,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 0,
      },
      {
        proposal_tx_hash: 'tx-1',
        proposal_index: 0,
        drep_yes_votes_cast: 2,
        drep_no_votes_cast: 2,
        drep_abstain_votes_cast: 1,
        pool_yes_votes_cast: 0,
        pool_no_votes_cast: 0,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 0,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 0,
      },
    ]);

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'proposals') return proposalsQuery;
        if (table === 'proposal_voting_summary') return summaryQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await fetchProposalListPage(supabase as any, {
      status: 'all',
      sort: 'newest',
      limit: 2,
      offset: 4,
    });

    expect(proposalsQuery.range).toHaveBeenCalledWith(4, 5);
    expect(summaryQuery.in).toHaveBeenCalledWith('proposal_tx_hash', ['tx-2', 'tx-1']);
    expect(result.total).toBe(20);
    expect(result.proposals.map((proposal) => proposal.txHash)).toEqual(['tx-2', 'tx-1']);
  });

  it('sorts filtered proposals by total votes for most_votes without materializing voter ids', async () => {
    const proposalsQuery = makeProposalsBroadQuery([
      {
        tx_hash: 'tx-1',
        proposal_index: 0,
        title: 'Low vote proposal',
        abstract: null,
        ai_summary: null,
        proposal_type: 'TreasuryWithdrawals',
        withdrawal_amount: null,
        treasury_tier: null,
        relevant_prefs: [],
        proposed_epoch: 10,
        block_time: 1_000,
        ratified_epoch: null,
        enacted_epoch: null,
        dropped_epoch: null,
        expired_epoch: null,
        expiration_epoch: 20,
        param_changes: null,
      },
      {
        tx_hash: 'tx-2',
        proposal_index: 1,
        title: 'High vote proposal',
        abstract: null,
        ai_summary: null,
        proposal_type: 'TreasuryWithdrawals',
        withdrawal_amount: null,
        treasury_tier: null,
        relevant_prefs: [],
        proposed_epoch: 11,
        block_time: 2_000,
        ratified_epoch: null,
        enacted_epoch: null,
        dropped_epoch: null,
        expired_epoch: null,
        expiration_epoch: 21,
        param_changes: null,
      },
    ]);
    const summaryQuery = makeSummaryQuery([
      {
        proposal_tx_hash: 'tx-1',
        proposal_index: 0,
        drep_yes_votes_cast: 1,
        drep_no_votes_cast: 0,
        drep_abstain_votes_cast: 0,
        pool_yes_votes_cast: 0,
        pool_no_votes_cast: 0,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 0,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 0,
      },
      {
        proposal_tx_hash: 'tx-2',
        proposal_index: 1,
        drep_yes_votes_cast: 5,
        drep_no_votes_cast: 2,
        drep_abstain_votes_cast: 1,
        pool_yes_votes_cast: 0,
        pool_no_votes_cast: 0,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 0,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 0,
      },
    ]);

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'proposals') return proposalsQuery;
        if (table === 'proposal_voting_summary') return summaryQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await fetchProposalListPage(supabase as any, {
      status: 'active',
      type: 'TreasuryWithdrawals',
      sort: 'most_votes',
      limit: 1,
      offset: 0,
    });

    expect(proposalsQuery.eq).toHaveBeenCalledWith('proposal_type', 'TreasuryWithdrawals');
    expect(result.total).toBe(2);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.txHash).toBe('tx-2');
    expect(result.proposals[0]?.totalVotes).toBe(8);
  });
});
