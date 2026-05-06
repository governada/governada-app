import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSupabaseAdmin = vi.fn();
const mockSelectIn = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock('@/lib/koios', () => ({
  blockTimeToEpoch: vi.fn(() => 200),
}));

import { getTier0Triggers, LOVELACE_PER_ADA } from '@/lib/governance/tier0Triggers';

interface ProposalRow {
  tx_hash: string;
  proposal_index: number;
  proposal_type: string;
  title: string | null;
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
  withdrawal_amount: number | null;
}

function proposal(overrides: Partial<ProposalRow>): ProposalRow {
  return {
    tx_hash: 'tx-default',
    proposal_index: 0,
    proposal_type: 'NoConfidence',
    title: null,
    ratified_epoch: 200,
    enacted_epoch: null,
    dropped_epoch: null,
    expired_epoch: null,
    withdrawal_amount: null,
    ...overrides,
  };
}

function treasury(overrides: Partial<ProposalRow>): ProposalRow {
  return proposal({
    proposal_type: 'TreasuryWithdrawals',
    ratified_epoch: 200,
    enacted_epoch: 200,
    withdrawal_amount: 1_000_000 * LOVELACE_PER_ADA,
    ...overrides,
  });
}

function mockProposalRows(rows: ProposalRow[]) {
  mockSelectIn.mockResolvedValue({ data: rows, error: null });
}

describe('getTier0Triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          in: mockSelectIn,
        }),
      }),
    });
  });

  it('sorts triggers by event epoch descending regardless of input order', async () => {
    mockProposalRows([
      proposal({
        tx_hash: 'tx-older',
        proposal_type: 'HardForkInitiation',
        ratified_epoch: 199,
        enacted_epoch: 199,
      }),
      proposal({
        tx_hash: 'tx-newer',
        proposal_type: 'NoConfidence',
        ratified_epoch: 200,
      }),
    ]);

    const triggers = await getTier0Triggers(new Date('2026-05-06T14:00:00.000Z'));

    expect(triggers.map((trigger) => trigger.proposalTxHash)).toEqual(['tx-newer', 'tx-older']);
  });

  it('sorts same-epoch triggers by Tier 0 type priority', async () => {
    mockProposalRows([
      treasury({ tx_hash: 'tx-treasury', enacted_epoch: 200 }),
      proposal({
        tx_hash: 'tx-constitution',
        proposal_type: 'UpdateConstitution',
        ratified_epoch: 200,
      }),
      proposal({
        tx_hash: 'tx-hard-fork',
        proposal_type: 'HardForkInitiation',
        ratified_epoch: 200,
        enacted_epoch: 200,
      }),
      proposal({
        tx_hash: 'tx-no-confidence',
        proposal_type: 'NoConfidence',
        ratified_epoch: 200,
      }),
    ]);

    const triggers = await getTier0Triggers(new Date('2026-05-06T14:00:00.000Z'));

    expect(triggers.map((trigger) => trigger.type)).toEqual([
      'constitutional_amendment_ratified',
      'hard_fork_enacted',
      'no_confidence_ratified',
      'major_treasury_withdrawal_closed',
    ]);
  });

  it('sorts same-epoch same-type triggers by transaction hash ascending', async () => {
    mockProposalRows([
      proposal({ tx_hash: 'tx-c', proposal_type: 'NoConfidence', ratified_epoch: 200 }),
      proposal({ tx_hash: 'tx-a', proposal_type: 'NoConfidence', ratified_epoch: 200 }),
      proposal({ tx_hash: 'tx-b', proposal_type: 'NoConfidence', ratified_epoch: 200 }),
    ]);

    const triggers = await getTier0Triggers(new Date('2026-05-06T14:00:00.000Z'));

    expect(triggers.map((trigger) => trigger.proposalTxHash)).toEqual(['tx-a', 'tx-b', 'tx-c']);
  });
});
