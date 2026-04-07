import { describe, expect, it } from 'vitest';
import {
  CITIZEN_PROPOSAL_ACTION_ID,
  getProposalConnectHref,
  getProposalDetailHref,
  getProposalGovernanceActionMessage,
  getProposalGovernanceActionState,
  getProposalWorkspaceReviewHref,
} from '@/lib/navigation/proposalAction';

describe('proposal action contract helper', () => {
  it('builds the canonical workspace review href', () => {
    expect(getProposalWorkspaceReviewHref('abc123', 7)).toBe('/workspace/review?proposal=abc123:7');
    expect(getProposalDetailHref('abc123', 7)).toBe('/proposal/abc123/7');
    expect(getProposalConnectHref('abc123', 7)).toBe(
      '/?connect=1&returnTo=%2Fproposal%2Fabc123%2F7',
    );
  });

  it('marks non-governance actors as ineligible for governance actions', () => {
    expect(getProposalGovernanceActionState('citizen', true, 'InfoAction')).toEqual({
      isGovernanceActor: false,
      canVote: false,
      reason: 'not-governance-actor',
    });
  });

  it('marks closed proposals as non-votable for governance actors', () => {
    const actionState = getProposalGovernanceActionState('drep', false, 'InfoAction');
    expect(actionState).toEqual({
      isGovernanceActor: true,
      canVote: false,
      reason: 'closed',
    });
    expect(getProposalGovernanceActionMessage(actionState)).toBe(
      'This proposal is no longer open for voting.',
    );
  });

  it('explains body-ineligible governance actors', () => {
    const actionState = getProposalGovernanceActionState('spo', true, 'TreasuryWithdrawals');
    expect(actionState).toEqual({
      isGovernanceActor: true,
      canVote: false,
      reason: 'body-ineligible',
    });
    expect(getProposalGovernanceActionMessage(actionState)).toBe(
      'Your governance body cannot vote on this proposal type.',
    );
  });

  it('keeps the citizen action anchor stable', () => {
    expect(CITIZEN_PROPOSAL_ACTION_ID).toBe('citizen-engagement');
  });
});
