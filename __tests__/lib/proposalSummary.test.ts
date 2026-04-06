import { describe, expect, it } from 'vitest';
import {
  buildProposalVoteSummary,
  buildTriBodyVotes,
  summarizeDRepVotes,
} from '@/lib/governance/proposalSummary';

describe('proposalSummary helpers', () => {
  it('builds tri-body vote groups from the canonical summary row', () => {
    expect(
      buildTriBodyVotes({
        drep_yes_votes_cast: 4,
        drep_no_votes_cast: 2,
        drep_abstain_votes_cast: 1,
        pool_yes_votes_cast: 3,
        pool_no_votes_cast: 1,
        pool_abstain_votes_cast: 0,
        committee_yes_votes_cast: 5,
        committee_no_votes_cast: 0,
        committee_abstain_votes_cast: 1,
      }),
    ).toEqual({
      drep: { yes: 4, no: 2, abstain: 1 },
      spo: { yes: 3, no: 1, abstain: 0 },
      cc: { yes: 5, no: 0, abstain: 1 },
    });
  });

  it('deduplicates voter ids while counting DRep votes', () => {
    expect(
      summarizeDRepVotes([
        { vote: 'Yes', drep_id: 'drep1' },
        { vote: 'No', drep_id: 'drep2' },
        { vote: 'Abstain', drep_id: 'drep1' },
      ]),
    ).toEqual({
      drepCounts: { yes: 1, no: 1, abstain: 1 },
      voterDrepIds: ['drep1', 'drep2'],
    });
  });

  it('maps proposal rows into the shared proposal summary contract with status', () => {
    const triBody = buildTriBodyVotes({
      drep_yes_votes_cast: 7,
      drep_no_votes_cast: 1,
      drep_abstain_votes_cast: 2,
      pool_yes_votes_cast: 3,
      pool_no_votes_cast: 2,
      pool_abstain_votes_cast: 1,
      committee_yes_votes_cast: 4,
      committee_no_votes_cast: 0,
      committee_abstain_votes_cast: 0,
    });

    expect(
      buildProposalVoteSummary({
        proposal: {
          tx_hash: 'abc123',
          proposal_index: 7,
          title: 'Fund Community Hubs',
          abstract: 'Regional governance hubs.',
          proposal_type: 'TreasuryWithdrawals',
          withdrawal_amount: '150000000',
          treasury_tier: 'medium',
          relevant_prefs: ['treasuryGrowth'],
          proposed_epoch: 510,
          block_time: 1730000000,
          ai_summary: 'AI summary',
          ratified_epoch: null,
          enacted_epoch: null,
          dropped_epoch: null,
          expired_epoch: null,
          expiration_epoch: 520,
          param_changes: { govActionLifetime: 12 },
        },
        drepCounts: triBody.drep,
        voterDrepIds: ['drep2', 'drep1', 'drep2'],
        triBody,
      }),
    ).toMatchObject({
      txHash: 'abc123',
      proposalIndex: 7,
      proposalType: 'TreasuryWithdrawals',
      status: 'active',
      withdrawalAmount: 150000000,
      yesCount: 7,
      noCount: 1,
      abstainCount: 2,
      totalVotes: 10,
      voterDrepIds: ['drep2', 'drep1'],
      triBody,
      paramChanges: { govActionLifetime: 12 },
    });
  });
});
