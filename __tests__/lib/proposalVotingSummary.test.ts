import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchLatestProposalVotingSummary,
  fetchProposalVotingSummaries,
  getProposalVotingSummaryKey,
  indexProposalVotingSummaries,
  indexProposalVotingSummaryTriBodies,
} from '@/lib/governance/proposalVotingSummary';

function makeInQuery(rows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };

  return chain;
}

function makeLatestQuery(rows: Array<Record<string, unknown>>, error: unknown = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue({ data: rows, error }),
  };

  return chain;
}

describe('proposalVotingSummary helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates tx hashes when fetching summary rows', async () => {
    const query = makeInQuery([
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
    ]);
    const supabase = {
      from: vi.fn(() => query),
    };

    const rows = await fetchProposalVotingSummaries(supabase as any, ['tx-1', 'tx-1']);

    expect(rows).toHaveLength(1);
    expect(query.in).toHaveBeenCalledWith('proposal_tx_hash', ['tx-1']);
  });

  it('returns the latest summary row and can fail closed or throw', async () => {
    const successQuery = makeLatestQuery([
      {
        proposal_tx_hash: 'tx-1',
        proposal_index: 0,
        drep_yes_votes_cast: 3,
        drep_no_votes_cast: 1,
        drep_abstain_votes_cast: 0,
        pool_yes_votes_cast: 2,
        pool_no_votes_cast: 1,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 4,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 0,
      },
    ]);
    const errorQuery = makeLatestQuery([], { message: 'boom' });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(successQuery)
        .mockReturnValueOnce(errorQuery)
        .mockReturnValueOnce(errorQuery),
    };

    await expect(
      fetchLatestProposalVotingSummary(supabase as any, { txHash: 'tx-1', proposalIndex: 0 }),
    ).resolves.toMatchObject({
      proposal_tx_hash: 'tx-1',
      proposal_index: 0,
      drep_yes_votes_cast: 3,
    });
    await expect(
      fetchLatestProposalVotingSummary(supabase as any, { txHash: 'tx-2', proposalIndex: 1 }),
    ).resolves.toBeNull();
    await expect(
      fetchLatestProposalVotingSummary(supabase as any, { txHash: 'tx-3', proposalIndex: 2 }, '*', {
        throwOnError: true,
      }),
    ).rejects.toEqual({ message: 'boom' });
  });

  it('indexes summary rows by proposal key and tri-body votes', () => {
    const rows = [
      {
        proposal_tx_hash: 'tx-1',
        proposal_index: 0,
        drep_yes_votes_cast: 3,
        drep_no_votes_cast: 1,
        drep_abstain_votes_cast: 0,
        pool_yes_votes_cast: 2,
        pool_no_votes_cast: 1,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 4,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 0,
      },
    ];

    expect(getProposalVotingSummaryKey('tx-1', 0)).toBe('tx-1-0');
    expect(indexProposalVotingSummaries(rows as any).get('tx-1-0')).toMatchObject(rows[0]);
    expect(indexProposalVotingSummaryTriBodies(rows as any).get('tx-1-0')).toEqual({
      drep: { yes: 3, no: 1, abstain: 0 },
      spo: { yes: 2, no: 1, abstain: 0 },
      cc: { yes: 4, no: 0, abstain: 0 },
    });
  });
});
