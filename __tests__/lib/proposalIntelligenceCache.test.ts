import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildPredictionInput = vi.fn();
const mockComputePassagePrediction = vi.fn();
const mockFetchPredictionData = vi.fn();
const mockResolvePassagePredictionThresholds = vi.fn();

vi.mock('@/lib/passagePrediction', () => ({
  buildPredictionInput: (...args: unknown[]) => mockBuildPredictionInput(...args),
  computePassagePrediction: (...args: unknown[]) => mockComputePassagePrediction(...args),
  fetchPredictionData: (...args: unknown[]) => mockFetchPredictionData(...args),
  resolvePassagePredictionThresholds: (...args: unknown[]) =>
    mockResolvePassagePredictionThresholds(...args),
}));

import {
  findProposalsNeedingIntelligencePrecompute,
  hashProposalIntelligenceContent,
  refreshPassagePredictionCache,
} from '@/lib/intelligence/proposalIntelligenceCache';

function createSupabaseStub(tableResults: Record<string, unknown>) {
  const upsert = vi.fn(async () => ({ error: null }));

  return {
    upsert,
    client: {
      from(table: string) {
        const payload = tableResults[table];
        const chain = {
          select: () => chain,
          is: () => chain,
          not: async () => ({ data: Array.isArray(payload) ? payload : [] }),
          in: async () => ({ data: Array.isArray(payload) ? payload : [] }),
          upsert,
        };
        return chain;
      },
    },
  };
}

describe('proposalIntelligenceCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters precompute targets by stale or missing cache sections', async () => {
    const proposal = {
      tx_hash: 'tx-1',
      proposal_index: 0,
      title: 'Treasury proposal',
      abstract: 'Abstract',
      proposal_type: 'TreasuryWithdrawals',
      withdrawal_amount: 100,
      param_changes: null,
      meta_json: {
        body: {
          motivation: 'Fund work',
          rationale: 'Good tradeoff',
        },
      },
    };

    const contentHash = hashProposalIntelligenceContent({
      title: proposal.title,
      abstract: proposal.abstract,
      proposal_type: proposal.proposal_type,
      motivation: 'Fund work',
      rationale: 'Good tradeoff',
    });

    const supabase = createSupabaseStub({
      proposals: [proposal],
      proposal_intelligence_cache: [
        {
          proposal_tx_hash: 'tx-1',
          proposal_index: 0,
          section_type: 'constitutional',
          content_hash: contentHash,
        },
        {
          proposal_tx_hash: 'tx-1',
          proposal_index: 0,
          section_type: 'key_questions',
          content_hash: 'stale-hash',
        },
      ],
    });

    const targets = await findProposalsNeedingIntelligencePrecompute(supabase.client as never);

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      tx_hash: 'tx-1',
      motivation: 'Fund work',
      rationale: 'Good tradeoff',
      contentHash,
    });
  });

  it('recomputes passage-prediction cache rows and upserts them in one batch', async () => {
    const supabase = createSupabaseStub({});

    mockFetchPredictionData.mockResolvedValue({
      voteMap: new Map(),
      constMap: new Map(),
      sentimentMap: new Map(),
    });
    mockBuildPredictionInput.mockReturnValue({
      input: {
        proposalType: 'TreasuryWithdrawals',
        drepVotes: { yes: 1, no: 0, abstain: 0 },
        spoVotes: { yes: 0, no: 0, abstain: 0 },
        ccVotes: { yes: 0, no: 0, abstain: 0 },
      },
      voteHash: 'votes-1',
    });
    mockResolvePassagePredictionThresholds.mockResolvedValue({
      drep: 0.67,
      spo: null,
      cc: 2 / 3,
    });
    mockComputePassagePrediction.mockReturnValue({
      probability: 72,
      confidence: 'medium',
      factors: [],
      computedAt: '2026-04-05T00:00:00.000Z',
    });

    const updated = await refreshPassagePredictionCache(
      supabase.client as never,
      [
        {
          tx_hash: 'tx-1',
          proposal_index: 0,
          proposal_type: 'TreasuryWithdrawals',
          withdrawal_amount: 100,
          param_changes: null,
        },
      ],
      { nowIso: '2026-04-05T00:00:00.000Z' },
    );

    expect(updated).toBe(1);
    expect(mockFetchPredictionData).toHaveBeenCalled();
    expect(mockResolvePassagePredictionThresholds).toHaveBeenCalledWith({
      proposalType: 'TreasuryWithdrawals',
      paramChanges: null,
    });
    expect(supabase.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          proposal_tx_hash: 'tx-1',
          proposal_index: 0,
          section_type: 'passage_prediction',
          content_hash: 'votes-1',
          updated_at: '2026-04-05T00:00:00.000Z',
        }),
      ],
      { onConflict: 'proposal_tx_hash,proposal_index,section_type' },
    );
  });
});
