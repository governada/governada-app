import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({}),
  getSupabaseAdmin: () => ({}),
}));

import {
  computeDelegationSimulation,
  type SimulationInput,
} from '@/lib/matching/delegationSimulation';
import type { DRepVoteRow, CachedProposal } from '@/lib/data';
import type { ProposalOutcome } from '@/lib/proposalOutcomes';

/* ─── Helpers ─────────────────────────────────────────── */

function makeVoteRow(overrides: Partial<DRepVoteRow> = {}): DRepVoteRow {
  return {
    vote_tx_hash: 'vtx_' + Math.random().toString(36).slice(2, 8),
    drep_id: 'drep1abc',
    proposal_tx_hash: 'tx_' + Math.random().toString(36).slice(2, 8),
    proposal_index: 0,
    vote: 'Yes',
    epoch_no: 490,
    block_time: Date.now(),
    meta_url: null,
    meta_hash: null,
    rationale_quality: null,
    ...overrides,
  };
}

function makeProposal(txHash: string, index: number): CachedProposal {
  return {
    txHash,
    proposalIndex: index,
    title: `Proposal ${txHash.slice(0, 8)}`,
    abstract: null,
    aiSummary: null,
    proposalType: 'TreasuryWithdrawals',
    withdrawalAmount: null,
    treasuryTier: null,
    relevantPrefs: [],
  };
}

function makeOutcome(txHash: string, index: number): ProposalOutcome {
  return {
    proposalTxHash: txHash,
    proposalIndex: index,
    deliveryStatus: 'delivered',
    deliveryScore: 85,
    totalPollResponses: 10,
    deliveredCount: 8,
    partialCount: 1,
    notDeliveredCount: 1,
    tooEarlyCount: 0,
    wouldApproveAgainPct: 80,
    milestonesTotal: 5,
    milestonesCompleted: 4,
    enactedEpoch: 480,
    lastEvaluatedEpoch: 490,
    epochsSinceEnactment: 10,
  };
}

/* ─── computeDelegationSimulation ─────────────────────── */

describe('computeDelegationSimulation', () => {
  it('returns empty simulation for 0 votes', () => {
    const result = computeDelegationSimulation({
      drepVotes: [],
      proposals: new Map(),
      outcomes: new Map(),
      currentEpoch: 500,
    });

    expect(result.drepVotedOn).toBe(0);
    expect(result.totalProposals).toBe(0);
    expect(result.participationRate).toBe(0);
    expect(result.simulatedVotes.length).toBe(0);
    expect(result.periodLabel).toContain('Epochs');
  });

  it('computes correct counts for 10 votes', () => {
    const votes: DRepVoteRow[] = [];
    const proposals = new Map<string, CachedProposal>();
    const outcomes = new Map<string, ProposalOutcome>();

    for (let i = 0; i < 10; i++) {
      const txHash = `tx_${i.toString().padStart(3, '0')}`;
      const vote = makeVoteRow({
        proposal_tx_hash: txHash,
        proposal_index: 0,
        vote: i < 7 ? 'Yes' : 'No',
        epoch_no: 480 + i,
      });
      votes.push(vote);
      proposals.set(`${txHash}-0`, makeProposal(txHash, 0));
    }

    const result = computeDelegationSimulation({
      drepVotes: votes,
      proposals,
      outcomes,
      currentEpoch: 500,
    });

    expect(result.drepVotedOn).toBe(10);
    expect(result.totalProposals).toBe(10);
    expect(result.simulatedVotes.length).toBe(10);
  });

  it('computes participation rate correctly', () => {
    const votes = [
      makeVoteRow({ proposal_tx_hash: 'tx_a', proposal_index: 0, epoch_no: 490 }),
      makeVoteRow({ proposal_tx_hash: 'tx_b', proposal_index: 0, epoch_no: 491 }),
      makeVoteRow({ proposal_tx_hash: 'tx_c', proposal_index: 0, epoch_no: 492 }),
    ];
    const proposals = new Map<string, CachedProposal>();
    votes.forEach((v) =>
      proposals.set(`${v.proposal_tx_hash}-0`, makeProposal(v.proposal_tx_hash, 0)),
    );

    const result = computeDelegationSimulation({
      drepVotes: votes,
      proposals,
      outcomes: new Map(),
      currentEpoch: 500,
    });

    // DRep voted on 3 unique proposals out of 3 total
    expect(result.participationRate).toBe(1);
  });

  it('aggregates delivery stats correctly', () => {
    const txHash = 'tx_delivered';
    const vote = makeVoteRow({
      proposal_tx_hash: txHash,
      proposal_index: 0,
      epoch_no: 490,
    });

    const proposals = new Map<string, CachedProposal>();
    proposals.set(`${txHash}-0`, makeProposal(txHash, 0));

    const outcomes = new Map<string, ProposalOutcome>();
    outcomes.set(`${txHash}-0`, makeOutcome(txHash, 0));

    const result = computeDelegationSimulation({
      drepVotes: [vote],
      proposals,
      outcomes,
      currentEpoch: 500,
    });

    expect(result.enactedCount).toBe(1);
    expect(result.deliverySuccessRate).toBe(100);
    expect(result.deliveryCoverage).toContain('1 of 1');
  });

  it('shows correct period label', () => {
    const result = computeDelegationSimulation({
      drepVotes: [makeVoteRow({ epoch_no: 490 })],
      proposals: new Map(),
      outcomes: new Map(),
      currentEpoch: 500,
      lookbackEpochs: 36,
    });

    expect(result.periodLabel).toContain('464');
    expect(result.periodLabel).toContain('500');
    expect(result.periodLabel).toContain('6 months');
  });

  it('populates alignment field when user alignment is provided', () => {
    const txHash = 'tx_aligned';
    const vote = makeVoteRow({
      proposal_tx_hash: txHash,
      proposal_index: 0,
      vote: 'Yes',
      epoch_no: 490,
    });

    const proposals = new Map<string, CachedProposal>();
    proposals.set(`${txHash}-0`, makeProposal(txHash, 0));

    const classifications = new Map();
    classifications.set(`${txHash}-0`, {
      dimTreasuryConservative: 0.9,
      dimTreasuryGrowth: 0.1,
      dimDecentralization: 0.1,
      dimSecurity: 0.1,
      dimInnovation: 0.1,
      dimTransparency: 0.1,
    });

    const result = computeDelegationSimulation({
      drepVotes: [vote],
      proposals,
      outcomes: new Map(),
      classifications,
      userAlignment: {
        treasuryConservative: 90,
        treasuryGrowth: 50,
        decentralization: 50,
        security: 50,
        innovation: 50,
        transparency: 50,
      },
      currentEpoch: 500,
    });

    expect(result.simulatedVotes[0].alignmentWithUser).toBe('agree');
    expect(result.alignedVoteCount).toBe(1);
    expect(result.totalClassifiedVotes).toBe(1);
  });

  it('returns null delivery stats when no outcomes exist', () => {
    const vote = makeVoteRow({ epoch_no: 490 });

    const result = computeDelegationSimulation({
      drepVotes: [vote],
      proposals: new Map(),
      outcomes: new Map(),
      currentEpoch: 500,
    });

    expect(result.deliverySuccessRate).toBeNull();
    expect(result.deliveryCoverage).toBeNull();
  });
});
