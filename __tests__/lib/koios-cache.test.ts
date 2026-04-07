import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFetchAllDReps,
  mockFetchDRepsWithDetails,
  mockFetchDRepVotes,
  mockCheckKoiosHealth,
  mockLoadCachedDRepVotes,
} = vi.hoisted(() => ({
  mockFetchAllDReps: vi.fn(),
  mockFetchDRepsWithDetails: vi.fn(),
  mockFetchDRepVotes: vi.fn(),
  mockCheckKoiosHealth: vi.fn(),
  mockLoadCachedDRepVotes: vi.fn(),
}));

vi.mock('@/utils/koios', () => ({
  fetchAllDReps: mockFetchAllDReps,
  fetchDRepsWithDetails: mockFetchDRepsWithDetails,
  fetchDRepVotes: mockFetchDRepVotes,
  checkKoiosHealth: mockCheckKoiosHealth,
  parseMetadataFields: vi.fn().mockReturnValue({
    name: 'DRep One',
    ticker: 'DR1',
    description: 'Example DRep',
  }),
}));

vi.mock('@/lib/retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock('@/lib/documentation', () => ({
  isWellDocumented: () => true,
}));

vi.mock('@/lib/data', () => ({
  getActiveProposalEpochs: vi.fn().mockResolvedValue(new Map([[100, 1]])),
  getActualProposalCount: vi.fn().mockResolvedValue(1),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({}),
}));

vi.mock('@/lib/drep-votes', async () => {
  const actual = await vi.importActual<typeof import('@/lib/drep-votes')>('@/lib/drep-votes');
  return {
    ...actual,
    loadCachedDRepVotes: mockLoadCachedDRepVotes,
  };
});

import { getEnrichedDReps } from '@/lib/koios';

describe('getEnrichedDReps', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCheckKoiosHealth.mockResolvedValue(true);
    mockFetchAllDReps.mockResolvedValue([
      {
        drep_id: 'drep1',
        drep_hash: 'hash1',
        hex: 'hex1',
        has_script: false,
        registered: true,
      },
    ]);
    mockFetchDRepsWithDetails.mockResolvedValue({
      info: [
        {
          drep_id: 'drep1',
          drep_hash: 'hash1',
          hex: 'hex1',
          has_script: false,
          registered: true,
          deposit: null,
          anchor_url: null,
          anchor_hash: null,
          amount: '1000000',
          active_epoch: 100,
        },
      ],
      metadata: [{ drep_id: 'drep1', meta_json: { body: { givenName: 'DRep One' } } }],
    });
    mockLoadCachedDRepVotes.mockResolvedValue({
      allVotesByDRep: {
        drep1: [
          {
            proposal_tx_hash: 'tx1',
            proposal_index: 0,
            vote_tx_hash: 'vote-1',
            block_time: 1_700_000_000,
            vote: 'Yes',
            meta_url: null,
            meta_hash: null,
            meta_json: null,
            epoch_no: 100,
            has_rationale: true,
          },
        ],
      },
      latestVotesByDRep: {
        drep1: [
          {
            proposal_tx_hash: 'tx1',
            proposal_index: 0,
            vote_tx_hash: 'vote-1',
            block_time: 1_700_000_000,
            vote: 'Yes',
            meta_url: null,
            meta_hash: null,
            meta_json: null,
            epoch_no: 100,
            has_rationale: true,
          },
        ],
      },
      maxBlockTime: 1_700_000_000,
    });
  });

  it('derives rationale_rate from cached vote signals without live Koios vote fetches', async () => {
    const result = await getEnrichedDReps(false, {
      includeRawVotes: true,
      proposalContextMap: new Map([
        ['tx1-0', { proposalType: 'HardForkInitiation', treasuryTier: null }],
      ]),
    });

    expect(result.error).toBe(false);
    expect(result.allDReps).toHaveLength(1);
    expect(result.allDReps[0].rationaleRate).toBe(100);
    expect(result.rawVotesMap?.drep1?.[0]?.has_rationale).toBe(true);
    expect(mockFetchDRepVotes).not.toHaveBeenCalled();
  });
});
