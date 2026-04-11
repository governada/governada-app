import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadVotingPowerSummaryModule({
  canonical,
  proposal,
  activeDreps = [],
  threshold = 0.67,
  votes = [],
}: {
  canonical: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
  activeDreps?: Array<{ info: Record<string, unknown> | null }>;
  threshold?: number | null;
  votes?: Array<{ vote: string; voting_power_lovelace: number | string | null }>;
}) {
  const getGovernanceThresholdForProposal = vi.fn().mockResolvedValue({
    threshold,
    thresholdKey: threshold != null ? 'dvt_p_p_gov_group' : null,
    thresholdKeys: threshold != null ? ['dvt_p_p_gov_group'] : [],
  });
  const fetchLatestProposalVotingSummary = vi.fn().mockResolvedValue(canonical);
  const proposalQuery = {
    select: vi.fn(() => proposalQuery),
    eq: vi.fn(() => proposalQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: proposal, error: null }),
  };
  const votesQuery = {
    select: vi.fn(() => votesQuery),
    eq: vi.fn(() => votesQuery),
    not: vi.fn().mockResolvedValue({ data: votes, error: null }),
  };
  const drepsQuery = {
    select: vi.fn(() => drepsQuery),
    eq: vi.fn().mockResolvedValue({ data: activeDreps, error: null }),
  };
  const from = vi.fn((table: string) => {
    if (table === 'proposals') return proposalQuery;
    if (table === 'drep_votes') return votesQuery;
    if (table === 'dreps') return drepsQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.doMock('@/lib/supabase', () => ({
    createClient: () => ({ from }),
  }));
  vi.doMock('@/lib/governanceThresholds', () => ({
    getGovernanceThresholdForProposal,
  }));
  vi.doMock('@/lib/governance/proposalVotingSummary', () => ({
    fetchLatestProposalVotingSummary,
  }));
  vi.doMock('@/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));

  const mod = await import('@/lib/governance/votingPowerSummary');
  return {
    getVotingPowerSummary: mod.getVotingPowerSummary,
    getGovernanceThresholdForProposal,
    fetchLatestProposalVotingSummary,
  };
}

describe('getVotingPowerSummary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses the stored proposal row when resolving the threshold source', async () => {
    const canonical = {
      drep_yes_vote_power: 100,
      drep_no_vote_power: 50,
      drep_abstain_vote_power: 25,
      drep_always_abstain_power: 10,
      drep_yes_votes_cast: 2,
      drep_no_votes_cast: 1,
      drep_abstain_votes_cast: 1,
    };
    const proposal = {
      proposal_type: 'ParameterChange',
      param_changes: { govActionLifetime: 10 },
    };
    const {
      getVotingPowerSummary,
      getGovernanceThresholdForProposal,
      fetchLatestProposalVotingSummary,
    } = await loadVotingPowerSummaryModule({
      canonical,
      proposal,
    });

    const result = await getVotingPowerSummary('tx1', 0, 'TreasuryWithdrawals');

    expect(getGovernanceThresholdForProposal).toHaveBeenCalledWith({
      proposalType: 'ParameterChange',
      paramChanges: { govActionLifetime: 10 },
    });
    expect(fetchLatestProposalVotingSummary).toHaveBeenCalledWith(expect.anything(), {
      txHash: 'tx1',
      proposalIndex: 0,
    });
    expect(result).toMatchObject({
      yesPower: 100,
      noPower: 50,
      abstainPower: 25,
      totalActivePower: 185,
      threshold: 0.67,
      thresholdLabel: '67% of active DRep stake needed',
    });
  });

  it('falls back to per-vote aggregation when the canonical summary row is missing', async () => {
    const { getVotingPowerSummary } = await loadVotingPowerSummaryModule({
      canonical: null,
      proposal: null,
      activeDreps: [
        { info: { votingPowerLovelace: '1000' } },
        { info: { votingPowerLovelace: '250' } },
      ],
      votes: [
        { vote: 'Yes', voting_power_lovelace: 400 },
        { vote: 'No', voting_power_lovelace: 300 },
        { vote: 'Abstain', voting_power_lovelace: 50 },
      ],
      threshold: null,
    });

    await expect(getVotingPowerSummary('tx1', 0, 'InfoAction')).resolves.toEqual({
      yesPower: 400,
      noPower: 300,
      abstainPower: 50,
      yesCount: 1,
      noCount: 1,
      abstainCount: 1,
      totalActivePower: 1250,
      threshold: null,
      thresholdLabel: null,
    });
  });
});
