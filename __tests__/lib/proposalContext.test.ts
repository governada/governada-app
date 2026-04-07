import { describe, expect, it } from 'vitest';
import {
  fetchGovernanceProposalContextSeed,
  fetchGovernanceProposalSnapshot,
  fetchGovernanceProposalVotingSnapshot,
  normalizeGovernanceProposalKey,
} from '@/lib/governance/proposalContext';

function createSupabaseStub(tableResults: Record<string, unknown>) {
  return {
    from(table: string) {
      const payload = tableResults[table];
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: payload ?? null, error: null }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve(resolve({ data: Array.isArray(payload) ? payload : [], error: null })),
      };
      return chain;
    },
  };
}

describe('proposalContext', () => {
  it('normalizes proposal keys from hash, hash#index, and hash/index formats', () => {
    expect(normalizeGovernanceProposalKey('tx-1')).toEqual({ txHash: 'tx-1', proposalIndex: 0 });
    expect(normalizeGovernanceProposalKey('tx-1#2')).toEqual({
      txHash: 'tx-1',
      proposalIndex: 2,
    });
    expect(normalizeGovernanceProposalKey('tx-1/3')).toEqual({
      txHash: 'tx-1',
      proposalIndex: 3,
    });
  });

  it('builds a normalized proposal snapshot with CIP-108 text fields', async () => {
    const supabase = createSupabaseStub({
      proposals: {
        tx_hash: 'tx-1',
        proposal_index: 0,
        title: 'Treasury proposal',
        abstract: 'Abstract',
        ai_summary: 'AI summary',
        proposal_type: 'TreasuryWithdrawals',
        withdrawal_amount: 15_000_000,
        treasury_tier: 'large',
        expiration_epoch: 120,
        proposed_epoch: 110,
        relevant_prefs: ['budget'],
        meta_json: {
          body: {
            motivation: 'Fund work',
            rationale: 'Good tradeoff',
          },
        },
        ratified_epoch: null,
        enacted_epoch: null,
        expired_epoch: null,
        dropped_epoch: null,
      },
    });

    const snapshot = await fetchGovernanceProposalSnapshot(supabase as never, 'tx-1/0');

    expect(snapshot).toEqual({
      txHash: 'tx-1',
      proposalIndex: 0,
      title: 'Treasury proposal',
      abstract: 'Abstract',
      aiSummary: 'AI summary',
      proposalType: 'TreasuryWithdrawals',
      withdrawalAmount: 15_000_000,
      treasuryTier: 'large',
      expirationEpoch: 120,
      proposedEpoch: 110,
      relevantPrefs: ['budget'],
      motivation: 'Fund work',
      rationale: 'Good tradeoff',
      status: 'active',
    });
  });

  it('builds a normalized voting snapshot with epochs remaining', async () => {
    const supabase = createSupabaseStub({
      proposal_voting_summary: [
        {
          drep_yes_votes_cast: 5,
          drep_no_votes_cast: 2,
          drep_abstain_votes_cast: 1,
          pool_yes_votes_cast: 3,
          pool_no_votes_cast: 1,
          pool_abstain_votes_cast: 0,
          committee_yes_votes_cast: 4,
          committee_no_votes_cast: 0,
          committee_abstain_votes_cast: 1,
        },
      ],
      proposals: {
        expiration_epoch: 120,
      },
      epoch_params: {
        epoch_no: 115,
      },
    });

    const snapshot = await fetchGovernanceProposalVotingSnapshot(supabase as never, 'tx-1#0');

    expect(snapshot).toEqual({
      drep: { yes: 5, no: 2, abstain: 1 },
      spo: { yes: 3, no: 1, abstain: 0 },
      cc: { yes: 4, no: 0, abstain: 1 },
      epochsRemaining: 5,
    });
  });

  it('builds a proposal context seed with a shared classification summary', async () => {
    const supabase = createSupabaseStub({
      proposals: {
        tx_hash: 'tx-1',
        proposal_index: 0,
        title: 'Treasury proposal',
        abstract: 'Abstract',
        ai_summary: 'AI summary',
        proposal_type: 'TreasuryWithdrawals',
        withdrawal_amount: 15_000_000,
        treasury_tier: 'large',
        expiration_epoch: 120,
        proposed_epoch: 110,
        relevant_prefs: ['budget'],
        meta_json: {
          body: {
            motivation: 'Fund work',
            rationale: 'Good tradeoff',
          },
        },
        ratified_epoch: null,
        enacted_epoch: null,
        expired_epoch: null,
        dropped_epoch: null,
      },
      proposal_voting_summary: [
        {
          drep_yes_votes_cast: 5,
          drep_no_votes_cast: 2,
          drep_abstain_votes_cast: 1,
          pool_yes_votes_cast: 3,
          pool_no_votes_cast: 1,
          pool_abstain_votes_cast: 0,
          committee_yes_votes_cast: 4,
          committee_no_votes_cast: 0,
          committee_abstain_votes_cast: 1,
        },
      ],
      epoch_params: {
        epoch_no: 115,
      },
      proposal_classifications: {
        dim_treasury_conservative: 0.25,
        dim_treasury_growth: 0.82,
        dim_decentralization: 0.1,
        dim_security: 0.2,
        dim_innovation: 0.4,
        dim_transparency: 0.3,
      },
    });

    const seed = await fetchGovernanceProposalContextSeed(supabase as never, 'tx-1#0');

    expect(seed).toMatchObject({
      proposal: {
        txHash: 'tx-1',
        proposalIndex: 0,
        title: 'Treasury proposal',
      },
      voting: {
        drep: { yes: 5, no: 2, abstain: 1 },
      },
      classification: {
        strongestDimension: 'treasuryGrowth',
        strongestScore: 0.82,
        strength: 'strong',
      },
    });
  });
});
