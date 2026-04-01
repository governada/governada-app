import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the data layer and supabase — all tool executors use dynamic imports
// ---------------------------------------------------------------------------

const mockDreps = [
  {
    drepId: 'drep1abc123def456',
    name: 'CardanoMaxi',
    handle: 'cardanomaxi',
    drepScore: 85,
    participationRate: 92,
    rationaleRate: 88,
    tier: 'Gold',
    alignmentTreasuryConservative: 80,
    alignmentTreasuryGrowth: 30,
    alignmentDecentralization: 70,
    alignmentSecurity: 60,
    alignmentInnovation: 50,
    alignmentTransparency: 65,
    description: 'Active governance participant',
  },
  {
    drepId: 'drep1xyz789ghi012',
    name: 'GovernanceFirst',
    handle: 'govfirst',
    drepScore: 72,
    participationRate: 80,
    rationaleRate: 65,
    tier: 'Silver',
    alignmentTreasuryConservative: 40,
    alignmentTreasuryGrowth: 80,
    alignmentDecentralization: 55,
    alignmentSecurity: 45,
    alignmentInnovation: 85,
    alignmentTransparency: 70,
    description: null,
  },
];

vi.mock('@/lib/data', () => ({
  getAllDReps: vi.fn(async () => ({ dreps: mockDreps })),
  getDRepById: vi.fn(async (id: string) => {
    const drep = mockDreps.find((d) => d.drepId === id);
    return drep ?? null;
  }),
  getDRepRank: vi.fn(async () => ({ rank: 5, total: 200 })),
  getVotesByDRepId: vi.fn(async () => [
    { proposal_title: 'Treasury withdrawal Q2', epoch_no: 524, vote: 'Yes', tx_hash: 'tx1' },
    { proposal_title: 'Parameter change: minFee', epoch_no: 523, vote: 'No', tx_hash: 'tx2' },
  ]),
  getLeaderboard: vi.fn(async () => mockDreps),
  getProposalByKey: vi.fn(async () => ({
    title: 'Fund Community Hubs',
    proposalType: 'TreasuryWithdrawals',
    status: 'active',
    abstract: 'Proposal to fund regional governance hubs.',
    txHash: 'abc123',
    certIndex: 0,
  })),
  getAllProposalsWithVoteSummary: vi.fn(async () => [
    {
      title: 'Fund Community Hubs',
      txHash: 'abc123',
      certIndex: 0,
      proposalType: 'TreasuryWithdrawals',
      status: 'active',
      voteSummary: { yes: 50, no: 20, abstain: 10 },
    },
  ]),
  getVotesByProposal: vi.fn(async () => []),
}));

vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{ ghi_score: 72.5, components: { participation: 65, representation: 80 } }],
            error: null,
          })),
        })),
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { balance_lovelace: '35000000000000' },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/intelligence/advisor-discovery-tools', () => ({
  executeHighlightCluster: vi.fn(async () => ({
    result: 'Highlighted cluster C1',
    globeCommands: [{ type: 'highlightCluster', clusterId: 'c1' }],
  })),
  executeShowNeighborhood: vi.fn(async () => ({
    result: 'Showing neighborhood',
    globeCommands: [],
  })),
  executeShowControversy: vi.fn(async () => ({
    result: 'Showing controversy',
    globeCommands: [],
  })),
  executeShowActiveEntities: vi.fn(async () => ({
    result: 'Showing active entities',
    globeCommands: [],
  })),
}));

// Logger mock
vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { executeAdvisorTool, getDisplayStatus } from '@/lib/intelligence/advisor-tools';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getDisplayStatus
// ---------------------------------------------------------------------------

describe('getDisplayStatus', () => {
  it('returns status for search_dreps', () => {
    expect(getDisplayStatus('search_dreps')).toContain('representative');
  });

  it('returns status for get_drep_profile', () => {
    const status = getDisplayStatus('get_drep_profile');
    expect(status.length).toBeGreaterThan(0);
  });

  it('returns status for get_proposal', () => {
    const status = getDisplayStatus('get_proposal');
    expect(status.length).toBeGreaterThan(0);
  });

  it('returns status for get_treasury_status', () => {
    const status = getDisplayStatus('get_treasury_status');
    expect(status).toContain('treasury');
  });

  it('returns status for get_governance_health', () => {
    const status = getDisplayStatus('get_governance_health');
    expect(status.length).toBeGreaterThan(0);
  });

  it('returns fallback for unknown tool', () => {
    const status = getDisplayStatus('nonexistent_tool');
    expect(status.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// executeAdvisorTool
// ---------------------------------------------------------------------------

describe('executeAdvisorTool', () => {
  describe('unknown tool', () => {
    it('returns unknown tool message', async () => {
      const result = await executeAdvisorTool('nonexistent', {});
      expect(result.result).toContain('Unknown tool');
      expect(result.globeCommands).toEqual([]);
    });
  });

  describe('search_dreps', () => {
    it('finds DReps by name', async () => {
      const result = await executeAdvisorTool('search_dreps', {
        query: 'cardano',
      });
      expect(result.result).toContain('CardanoMaxi');
      expect(result.result).toContain('Found');
      expect(result.globeCommands.length).toBeGreaterThan(0);
    });

    it('returns no results message for non-matching query', async () => {
      const result = await executeAdvisorTool('search_dreps', {
        query: 'zzzznonexistent',
      });
      expect(result.result).toContain('No DReps found');
    });

    it('finds DReps by alignment keyword', async () => {
      const result = await executeAdvisorTool('search_dreps', {
        query: 'treasury',
      });
      expect(result.result).toContain('Found');
      // Should emit highlight command for alignment search
      const highlightCmd = result.globeCommands.find((c) => c.type === 'highlight');
      expect(highlightCmd).toBeDefined();
    });
  });

  describe('get_drep_profile', () => {
    it('returns profile for known DRep ID', async () => {
      const result = await executeAdvisorTool('get_drep_profile', {
        drep_id: 'drep1abc123def456',
      });
      expect(result.result).toContain('CardanoMaxi');
      expect(result.result).toContain('85');
      // Should emit flyTo command
      const flyTo = result.globeCommands.find((c) => c.type === 'flyTo');
      expect(flyTo).toBeDefined();
    });

    it('searches by name when ID is not bech32', async () => {
      const result = await executeAdvisorTool('get_drep_profile', {
        drep_id: 'CardanoMaxi',
      });
      expect(result.result).toContain('CardanoMaxi');
    });

    it('returns not found for unknown name', async () => {
      const result = await executeAdvisorTool('get_drep_profile', {
        drep_id: 'zzzzunknown',
      });
      expect(result.result).toContain('not found');
    });
  });

  describe('get_drep_votes', () => {
    it('returns vote history', async () => {
      const result = await executeAdvisorTool('get_drep_votes', {
        drep_id: 'drep1abc123def456',
        limit: 5,
      });
      expect(result.result).toContain('Treasury withdrawal');
      expect(result.result).toContain('Parameter change');
    });
  });

  describe('list_proposals', () => {
    it('lists proposals', async () => {
      const result = await executeAdvisorTool('list_proposals', {
        status: 'active',
        limit: 10,
      });
      expect(result.result).toContain('Fund Community Hubs');
    });
  });

  describe('highlight_cluster', () => {
    it('delegates to discovery tools', async () => {
      const result = await executeAdvisorTool('highlight_cluster', {
        cluster_id: 'c1',
      });
      expect(result.result).toContain('Highlighted cluster');
    });
  });

  describe('error handling', () => {
    it('returns error message and reset command on failure', async () => {
      const { getAllDReps } = await import('@/lib/data');
      vi.mocked(getAllDReps).mockRejectedValueOnce(new Error('DB connection failed'));

      const result = await executeAdvisorTool('search_dreps', { query: 'test' });
      expect(result.result).toContain('Error executing search_dreps');
      expect(result.result).toContain('DB connection failed');
      expect(result.globeCommands).toEqual([{ type: 'reset' }]);
    });
  });
});
