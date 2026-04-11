import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getGovernanceThresholdForProposal = vi.hoisted(() => vi.fn());

vi.mock('@/lib/governanceThresholds', () => ({
  getGovernanceThresholdForProposal,
}));

function makeDRepRow(updatedAt: string) {
  return {
    id: 'drep1',
    info: {
      drepHash: 'drep1hash',
      name: 'Alice',
      isActive: true,
      votingPower: 123,
      votingPowerLovelace: '123',
    },
    score: 82,
    participation_rate: 0.8,
    rationale_rate: 0.7,
    reliability_score: 0.9,
    reliability_streak: 3,
    reliability_recency: 1,
    reliability_longest_gap: 0,
    reliability_tenure: 12,
    deliberation_modifier: 1,
    effective_participation: 0.8,
    size_tier: 'Small',
    anchor_hash: null,
    metadata: null,
    profile_completeness: 0.6,
    alignment_treasury_conservative: null,
    alignment_treasury_growth: null,
    alignment_decentralization: null,
    alignment_security: null,
    alignment_innovation: null,
    alignment_transparency: null,
    last_vote_time: null,
    metadata_hash_verified: null,
    updated_at: updatedAt,
    engagement_quality: null,
    engagement_quality_raw: null,
    effective_participation_v3: null,
    effective_participation_v3_raw: null,
    reliability_v3: null,
    reliability_v3_raw: null,
    governance_identity: null,
    governance_identity_raw: null,
    score_momentum: null,
  };
}

async function loadDataModule(rows: unknown[]) {
  const getEnrichedDReps = vi.fn();
  const abortSignal = vi.fn().mockResolvedValue({ data: rows, error: null });
  const range = vi.fn(() => ({ abortSignal }));
  const order = vi.fn(() => ({ range }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  const send = vi.fn().mockResolvedValue(undefined);

  vi.doMock('@/lib/supabase', () => ({
    createClient: () => ({ from }),
  }));
  vi.doMock('@/lib/inngest', () => ({
    inngest: { send },
  }));
  vi.doMock('@/lib/koios', () => ({
    getEnrichedDReps,
  }));
  vi.doMock('@/utils/documentation', () => ({
    isWellDocumented: vi.fn(() => true),
  }));
  vi.doMock('@/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock('@/lib/constants', () => ({
    getCurrentEpoch: vi.fn(() => 999),
  }));

  const mod = await import('@/lib/data');
  return { getAllDReps: mod.getAllDReps, send, getEnrichedDReps };
}

async function loadVotingPowerSummaryModule({
  canonical,
  proposal,
  threshold = 0.42,
}: {
  canonical: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
  threshold?: number | null;
}) {
  getGovernanceThresholdForProposal.mockImplementation(async (args) => {
    expect(args).toEqual({
      proposalType: 'ParameterChange',
      paramChanges: { govActionLifetime: 10 },
    });
    return {
      threshold,
      thresholdKey: threshold != null ? 'dvt_p_p_gov_group' : null,
      thresholdKeys: threshold != null ? ['dvt_p_p_gov_group'] : [],
    };
  });

  function makeResolvedQuery(
    data: Record<string, unknown> | null,
    terminal: 'single' | 'maybeSingle',
  ) {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit:
        terminal === 'single'
          ? vi.fn().mockResolvedValue({ data: data ? [data] : [], error: null })
          : vi.fn().mockResolvedValue({ data: data ? [data] : [], error: null }),
      single:
        terminal === 'single'
          ? vi.fn().mockResolvedValue({ data, error: null })
          : vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle:
        terminal === 'maybeSingle'
          ? vi.fn().mockResolvedValue({ data, error: null })
          : vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    return chain;
  }

  const canonicalQuery = makeResolvedQuery(canonical, 'single');
  const proposalQuery = makeResolvedQuery(proposal, 'maybeSingle');
  const votesQuery = {
    select: vi.fn(() => votesQuery),
    eq: vi.fn(() => votesQuery),
    not: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const drepsQuery = {
    select: vi.fn(() => drepsQuery),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const from = vi.fn((table: string) => {
    if (table === 'proposal_voting_summary') return canonicalQuery;
    if (table === 'proposals') return proposalQuery;
    if (table === 'drep_votes') return votesQuery;
    if (table === 'dreps') return drepsQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.doMock('@/lib/supabase', () => ({
    createClient: () => ({ from }),
  }));
  vi.doMock('@/utils/documentation', () => ({
    isWellDocumented: vi.fn(() => true),
  }));
  vi.doMock('@/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock('@/lib/constants', () => ({
    getCurrentEpoch: vi.fn(() => 999),
  }));

  const mod = await import('@/lib/data');
  return { getVotingPowerSummary: mod.getVotingPowerSummary, getGovernanceThresholdForProposal };
}

async function loadProposalListModule(
  proposals: Array<{ tx_hash: string; proposal_index: number }>,
) {
  const fetchProposalVotingSummaries = vi.fn().mockResolvedValue([]);
  const indexProposalVotingSummaryTriBodies = vi.fn(() => new Map());
  const buildProposalVoteSummary = vi.fn(({ proposal }) => ({
    txHash: proposal.tx_hash,
    proposalIndex: proposal.proposal_index,
    title: proposal.title ?? null,
    abstract: proposal.abstract ?? null,
    aiSummary: proposal.ai_summary ?? null,
    proposalType: proposal.proposal_type ?? null,
    status: 'active',
    withdrawalAmount: null,
    treasuryTier: null,
    relevantPrefs: [],
    proposedEpoch: null,
    ratifiedEpoch: null,
    enactedEpoch: null,
    droppedEpoch: null,
    expiredEpoch: null,
    expirationEpoch: null,
    blockTime: null,
    yesCount: 0,
    noCount: 0,
    abstainCount: 0,
    totalVotes: 0,
    triBody: null,
  }));

  const proposalsAbortSignal = vi.fn().mockResolvedValue({ data: proposals, error: null });
  const proposalsOrder = vi.fn(() => ({ abortSignal: proposalsAbortSignal }));
  const proposalsSelect = vi.fn(() => ({ order: proposalsOrder }));
  const drepVotesIn = vi.fn().mockResolvedValue({ data: [], error: null });
  const drepVotesSelect = vi.fn(() => ({ in: drepVotesIn }));

  const from = vi.fn((table: string) => {
    if (table === 'proposals') return { select: proposalsSelect };
    if (table === 'drep_votes') return { select: drepVotesSelect };
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.doMock('@/lib/supabase', () => ({
    createClient: () => ({ from }),
  }));
  vi.doMock('@/lib/governance/proposalVotingSummary', () => ({
    fetchProposalVotingSummaries,
    fetchLatestProposalVotingSummary: vi.fn(),
    getProposalVotingSummaryKey: (txHash: string, proposalIndex: number) =>
      `${txHash}-${proposalIndex}`,
    indexProposalVotingSummaryTriBodies,
  }));
  vi.doMock('@/lib/governance/proposalSummary', () => ({
    buildProposalVoteSummary,
    buildTriBodyVotes: vi.fn(),
    summarizeDRepVotes: vi.fn(() => ({
      drepCounts: { yes: 0, no: 0, abstain: 0 },
      voterDrepIds: [],
    })),
  }));
  vi.doMock('@/utils/documentation', () => ({
    isWellDocumented: vi.fn(() => true),
  }));
  vi.doMock('@/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock('@/lib/constants', () => ({
    getCurrentEpoch: vi.fn(() => 999),
  }));

  const mod = await import('@/lib/data');
  return {
    getAllProposalsWithVoteSummary: mod.getAllProposalsWithVoteSummary,
    drepVotesIn,
    fetchProposalVotingSummaries,
  };
}

describe('getAllDReps freshness policy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T16:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not retrigger syncs during the expected DRep sync window', async () => {
    const { getAllDReps, send } = await loadDataModule([makeDRepRow('2026-04-03T09:30:00.000Z')]);

    const result = await getAllDReps();
    await vi.dynamicImportSettled();

    expect(result.error).toBe(false);
    expect(result.allDReps).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('retriggers syncs only after the overdue threshold is exceeded', async () => {
    const { getAllDReps, send } = await loadDataModule([makeDRepRow('2026-04-03T07:59:00.000Z')]);

    const result = await getAllDReps();
    await vi.dynamicImportSettled();

    expect(result.error).toBe(false);
    expect(result.allDReps).toHaveLength(1);
    expect(send).toHaveBeenCalledWith({ name: 'drepscore/sync.dreps' });
  });

  it('fails the shared read instead of falling back to Koios when the cache is empty', async () => {
    const { getAllDReps, getEnrichedDReps } = await loadDataModule([]);

    await expect(getAllDReps()).rejects.toThrow('DRep cache is empty');
    expect(getEnrichedDReps).not.toHaveBeenCalled();
  });
});

describe('getVotingPowerSummary threshold resolution', () => {
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
    const { getVotingPowerSummary, getGovernanceThresholdForProposal } =
      await loadVotingPowerSummaryModule({
        canonical,
        proposal,
      });

    const result = await getVotingPowerSummary('tx1', 0, 'TreasuryWithdrawals');

    expect(result).toMatchObject({
      yesPower: 100,
      noPower: 50,
      abstainPower: 25,
      totalActivePower: 185,
      threshold: 0.42,
      thresholdLabel: '42% of active DRep stake needed',
    });
  });
});

describe('getAllProposalsWithVoteSummary query bounds', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('limits proposal voter lookups to the fetched proposal tx hashes', async () => {
    const proposals = [
      { tx_hash: 'tx1', proposal_index: 0 },
      { tx_hash: 'tx2', proposal_index: 1 },
    ];
    const { getAllProposalsWithVoteSummary, drepVotesIn, fetchProposalVotingSummaries } =
      await loadProposalListModule(proposals);

    const result = await getAllProposalsWithVoteSummary();

    expect(fetchProposalVotingSummaries).toHaveBeenCalledWith(
      expect.anything(),
      ['tx1', 'tx2'],
      expect.stringContaining('proposal_tx_hash'),
    );
    expect(drepVotesIn).toHaveBeenCalledWith('proposal_tx_hash', ['tx1', 'tx2']);
    expect(result).toHaveLength(2);
  });
});
