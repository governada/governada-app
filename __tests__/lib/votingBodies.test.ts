import { describe, expect, it } from 'vitest';

import { canBodyVote, getIneligibilityNote, getVotingBodies } from '@/lib/governance/votingBodies';

describe('governance voting body eligibility', () => {
  it('treats treasury withdrawals as DRep plus CC only', () => {
    expect(getVotingBodies('TreasuryWithdrawals')).toEqual(['drep', 'cc']);
    expect(canBodyVote('spo', 'TreasuryWithdrawals')).toBe(false);
    expect(getIneligibilityNote('TreasuryWithdrawals')).toBe(
      'SPOs are not eligible to vote on Treasury Withdrawals.',
    );
  });

  it('treats committee updates as DRep plus SPO only', () => {
    expect(getVotingBodies('NewCommittee')).toEqual(['drep', 'spo']);
    expect(getVotingBodies('NewConstitutionalCommittee')).toEqual(['drep', 'spo']);
    expect(canBodyVote('cc', 'NewCommittee')).toBe(false);
    expect(getIneligibilityNote('NewCommittee')).toBe(
      'CC members are not eligible to vote on Update Committee actions.',
    );
  });

  it('treats constitution updates as DRep plus CC only', () => {
    expect(getVotingBodies('NewConstitution')).toEqual(['drep', 'cc']);
    expect(getVotingBodies('UpdateConstitution')).toEqual(['drep', 'cc']);
    expect(canBodyVote('spo', 'NewConstitution')).toBe(false);
  });

  it('allows all bodies to vote on info actions', () => {
    expect(getVotingBodies('InfoAction')).toEqual(['drep', 'spo', 'cc']);
    expect(getIneligibilityNote('InfoAction')).toBeNull();
  });

  it('only allows SPOs on security-relevant parameter updates', () => {
    const technicalSecurityUpdate = { maxTxSize: 16384 };
    const economicSecurityUpdate = { txFeePerByte: 44 };
    const governanceSecurityUpdate = { govActionDeposit: 100_000_000_000 };
    const governanceOnlyUpdate = { govActionLifetime: 12 };

    expect(getVotingBodies('ParameterChange', technicalSecurityUpdate)).toEqual([
      'drep',
      'spo',
      'cc',
    ]);
    expect(getVotingBodies('ParameterChange', economicSecurityUpdate)).toEqual([
      'drep',
      'spo',
      'cc',
    ]);
    expect(getVotingBodies('ParameterChange', governanceSecurityUpdate)).toEqual([
      'drep',
      'spo',
      'cc',
    ]);
    expect(getVotingBodies('ParameterChange', governanceOnlyUpdate)).toEqual(['drep', 'cc']);
    expect(canBodyVote('spo', 'ParameterChange', technicalSecurityUpdate)).toBe(true);
    expect(canBodyVote('spo', 'ParameterChange', economicSecurityUpdate)).toBe(true);
    expect(canBodyVote('spo', 'ParameterChange', governanceSecurityUpdate)).toBe(true);
    expect(canBodyVote('spo', 'ParameterChange', governanceOnlyUpdate)).toBe(false);
    expect(getIneligibilityNote('ParameterChange', governanceOnlyUpdate)).toBe(
      'SPOs only vote on security-relevant parameter updates.',
    );
  });
});
