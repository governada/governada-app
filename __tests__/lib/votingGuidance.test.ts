import { describe, expect, it } from 'vitest';

import {
  getDraftParamChanges,
  getDraftVotingGuidance,
  getVotingGuidance,
} from '@/lib/governance/votingGuidance';

describe('governance voting guidance', () => {
  it('describes treasury withdrawals through the shared eligibility layer', () => {
    const guidance = getVotingGuidance('TreasuryWithdrawals');

    expect(guidance.bodies).toEqual(['drep', 'cc']);
    expect(guidance.bodiesCompact).toBe('DReps + Constitutional Committee');
    expect(guidance.requirementsSummary).toBe(
      'Requires DRep approval and Constitutional Committee confirmation. SPOs are not eligible to vote on Treasury Withdrawals.',
    );
    expect(guidance.thresholdSummary).toBe(
      'Must satisfy the treasury withdrawal threshold with DRep approval and Constitutional Committee confirmation.',
    );
  });

  it('keeps governance-only parameter changes out of SPO-facing copy', () => {
    const guidance = getVotingGuidance('ParameterChange', { govActionLifetime: 12 });

    expect(guidance.bodies).toEqual(['drep', 'cc']);
    expect(guidance.bodiesSentence).toBe('DReps and the Constitutional Committee');
    expect(guidance.thresholdSummary).toContain('governance parameter threshold');
    expect(guidance.thresholdSummary).toContain(
      'SPOs only vote on security-relevant parameter updates.',
    );
    expect(guidance.postSubmissionSummary).toBe(
      'DReps and the Constitutional Committee will review and vote on your proposal.',
    );
  });

  it('treats security-relevant authoring drafts as tri-body proposals', () => {
    const guidance = getDraftVotingGuidance('ParameterChange', {
      parameterName: 'maxTxSize',
      proposedValue: '16384',
    });

    expect(guidance.bodies).toEqual(['drep', 'spo', 'cc']);
    expect(guidance.bodiesCompact).toBe('DReps + SPOs + Constitutional Committee');
    expect(guidance.thresholdSummary).toContain('network parameter threshold');
    expect(guidance.postSubmissionSummary).toBe(
      'DReps, SPOs, and the Constitutional Committee will review and vote on your proposal.',
    );
  });

  it('reuses explicit paramChanges from draft type-specific payloads', () => {
    expect(getDraftParamChanges({ paramChanges: { maxBlockBodySize: 90112 } })).toEqual({
      maxBlockBodySize: 90112,
    });
  });

  it('marks info actions as advisory across copy surfaces', () => {
    const guidance = getVotingGuidance('InfoAction');

    expect(guidance.bodies).toEqual(['drep', 'spo', 'cc']);
    expect(guidance.thresholdSummary).toBe(
      'Advisory signal only. This action does not enact changes on-chain.',
    );
    expect(guidance.postSubmissionSummary).toBe(
      'DReps, SPOs, and the Constitutional Committee can all signal on your proposal.',
    );
  });
});
