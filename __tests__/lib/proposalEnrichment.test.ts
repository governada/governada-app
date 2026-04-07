import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadProposalEnrichmentModule(from: ReturnType<typeof vi.fn>) {
  vi.doMock('@/lib/supabase', () => ({
    createClient: () => ({ from }),
  }));
  vi.doMock('@/lib/logger', () => ({
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));

  return import('@/lib/governance/proposalEnrichment');
}

describe('proposalEnrichment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('filters proposal rows by the requested tx hash and proposal index pair', async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [
        {
          tx_hash: 'tx-1',
          proposal_index: 0,
          title: 'Keep',
          abstract: 'Keep this row',
          ai_summary: 'Summary',
          proposal_type: 'TreasuryWithdrawals',
          withdrawal_amount: '1250000',
          treasury_tier: 'routine',
          relevant_prefs: ['security'],
        },
        {
          tx_hash: 'tx-1',
          proposal_index: 1,
          title: 'Drop',
          abstract: 'Wrong proposal index',
          ai_summary: null,
          proposal_type: 'InfoAction',
          withdrawal_amount: null,
          treasury_tier: null,
          relevant_prefs: [],
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ in: inMock }));
    const from = vi.fn(() => ({ select }));

    const { getProposalsByIds } = await loadProposalEnrichmentModule(from);

    const result = await getProposalsByIds([{ txHash: 'tx-1', index: 0 }]);

    expect(from).toHaveBeenCalledWith('proposals');
    expect(result.size).toBe(1);
    expect(result.get('tx-1-0')).toEqual({
      txHash: 'tx-1',
      proposalIndex: 0,
      title: 'Keep',
      abstract: 'Keep this row',
      aiSummary: 'Summary',
      proposalType: 'TreasuryWithdrawals',
      withdrawalAmount: 1250000,
      treasuryTier: 'routine',
      relevantPrefs: ['security'],
    });
  });

  it('maps rationale rows by vote transaction hash', async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [
        {
          vote_tx_hash: 'vote-1',
          rationale_text: 'Detailed rationale',
          ai_summary: 'AI summary',
          hash_verified: true,
        },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ in: inMock }));
    const from = vi.fn(() => ({ select }));

    const { getRationalesByVoteTxHashes } = await loadProposalEnrichmentModule(from);

    const result = await getRationalesByVoteTxHashes(['vote-1']);

    expect(from).toHaveBeenCalledWith('vote_rationales');
    expect(result.get('vote-1')).toEqual({
      rationaleText: 'Detailed rationale',
      rationaleAiSummary: 'AI summary',
      hashVerified: true,
    });
  });

  it('returns vote rows ordered from the drep vote query result', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          vote_tx_hash: 'vote-2',
          drep_id: 'drep1test',
          proposal_tx_hash: 'tx-2',
          proposal_index: 0,
          vote: 'No',
          epoch_no: 601,
          block_time: 123456,
          meta_url: null,
          meta_hash: null,
          rationale_quality: 0.4,
          rationale_specificity: 0.5,
          rationale_reasoning_depth: 0.6,
          rationale_proposal_awareness: 0.7,
        },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const { getVotesByDRepId } = await loadProposalEnrichmentModule(from);

    await expect(getVotesByDRepId('drep1test')).resolves.toEqual([
      {
        vote_tx_hash: 'vote-2',
        drep_id: 'drep1test',
        proposal_tx_hash: 'tx-2',
        proposal_index: 0,
        vote: 'No',
        epoch_no: 601,
        block_time: 123456,
        meta_url: null,
        meta_hash: null,
        rationale_quality: 0.4,
        rationale_specificity: 0.5,
        rationale_reasoning_depth: 0.6,
        rationale_proposal_awareness: 0.7,
      },
    ]);
    expect(from).toHaveBeenCalledWith('drep_votes');
    expect(order).toHaveBeenCalledWith('block_time', { ascending: false });
  });
});
