import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockGetSupabaseAdmin = vi.fn();
const mockGetGovernanceThresholdForProposal = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/api/withRouteHandler', () => ({
  withRouteHandler: (handler: unknown) => handler,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock('@/lib/governanceThresholds', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getGovernanceThresholdForProposal: (proposal: unknown) =>
      mockGetGovernanceThresholdForProposal(proposal),
  };
});

vi.mock('@/lib/koios', () => ({
  blockTimeToEpoch: vi.fn(() => 100),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

import { GET } from '@/app/api/workspace/proposals/monitor/route';

function makeProposalQuery(proposal: Record<string, unknown> | null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: proposal, error: null }),
  };

  return chain;
}

function makeSummaryQuery(summaryRows: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue({ data: summaryRows, error: null }),
  };

  return chain;
}

function makeVoteQuery(votes: Array<Record<string, unknown>>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue({ data: votes, error: null }),
  };

  return chain;
}

describe('GET /api/workspace/proposals/monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits SPO voting for governance-only parameter changes', async () => {
    const proposalQuery = makeProposalQuery({
      tx_hash: 'tx-1',
      proposal_index: 0,
      title: 'Governance parameter change',
      proposal_type: 'ParameterChange',
      param_changes: { govActionLifetime: 12 },
      proposed_epoch: 95,
      ratified_epoch: null,
      enacted_epoch: null,
      expired_epoch: null,
      dropped_epoch: null,
      expiration_epoch: 110,
    });
    const summaryQuery = makeSummaryQuery([
      {
        drep_yes_votes_cast: 2,
        drep_yes_vote_power: 100,
        drep_no_votes_cast: 1,
        drep_no_vote_power: 40,
        drep_abstain_votes_cast: 0,
        drep_abstain_vote_power: 0,
        committee_yes_votes_cast: 3,
        committee_no_votes_cast: 1,
        committee_abstain_votes_cast: 0,
        pool_yes_votes_cast: 5,
        pool_yes_vote_power: 500,
      },
    ]);
    const voteQuery = makeVoteQuery([]);

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'proposals') return proposalQuery;
        if (table === 'proposal_voting_summary') return summaryQuery;
        if (table === 'drep_votes') return voteQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
    mockGetGovernanceThresholdForProposal.mockResolvedValue({
      threshold: 0.75,
      thresholdKey: 'dvt_p_p_gov_group',
      thresholdKeys: ['dvt_p_p_gov_group'],
    });

    const res = await GET(
      createRequest('/api/workspace/proposals/monitor?txHash=tx-1&proposalIndex=0'),
    );
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.voting.drep.threshold).toBe(0.75);
    expect(body.voting.spo).toBeUndefined();
    expect(body.voting.cc.threshold).toBeCloseTo(2 / 3, 5);
  });

  it('shows all bodies for info actions with the correct fixed thresholds', async () => {
    const proposalQuery = makeProposalQuery({
      tx_hash: 'tx-2',
      proposal_index: 1,
      title: 'Info action',
      proposal_type: 'InfoAction',
      param_changes: null,
      proposed_epoch: 95,
      ratified_epoch: null,
      enacted_epoch: null,
      expired_epoch: null,
      dropped_epoch: null,
      expiration_epoch: 110,
    });
    const summaryQuery = makeSummaryQuery([
      {
        drep_yes_votes_cast: 2,
        drep_yes_vote_power: 100,
        drep_no_votes_cast: 1,
        drep_no_vote_power: 40,
        drep_abstain_votes_cast: 0,
        drep_abstain_vote_power: 0,
        committee_yes_votes_cast: 3,
        committee_no_votes_cast: 1,
        committee_abstain_votes_cast: 0,
        pool_yes_votes_cast: 5,
        pool_yes_vote_power: 500,
        pool_no_votes_cast: 1,
        pool_no_vote_power: 100,
        pool_abstain_votes_cast: 0,
        pool_abstain_vote_power: 0,
      },
    ]);
    const voteQuery = makeVoteQuery([]);

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'proposals') return proposalQuery;
        if (table === 'proposal_voting_summary') return summaryQuery;
        if (table === 'drep_votes') return voteQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const res = await GET(
      createRequest('/api/workspace/proposals/monitor?txHash=tx-2&proposalIndex=1'),
    );
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.voting.drep.threshold).toBe(1);
    expect(body.voting.spo.threshold).toBe(1);
    expect(body.voting.cc.threshold).toBeCloseTo(2 / 3, 5);
    expect(mockGetGovernanceThresholdForProposal).not.toHaveBeenCalled();
  });
});
