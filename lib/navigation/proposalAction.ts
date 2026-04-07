import type { UserSegment } from '@/components/providers/SegmentProvider';
import { canBodyVote } from '@/lib/governance/votingBodies';

export const CITIZEN_PROPOSAL_ACTION_ID = 'citizen-engagement';

type GovernanceActionReason = 'eligible' | 'closed' | 'body-ineligible' | 'not-governance-actor';

export interface ProposalGovernanceActionState {
  isGovernanceActor: boolean;
  canVote: boolean;
  reason: GovernanceActionReason;
}

export function getProposalDetailHref(txHash: string, proposalIndex: number): string {
  return `/proposal/${encodeURIComponent(txHash)}/${proposalIndex}`;
}

export function getProposalWorkspaceReviewHref(txHash: string, proposalIndex: number): string {
  return `/workspace/review?proposal=${encodeURIComponent(txHash)}:${proposalIndex}`;
}

export function getProposalConnectHref(txHash: string, proposalIndex: number): string {
  const params = new URLSearchParams({
    connect: '1',
    returnTo: getProposalDetailHref(txHash, proposalIndex),
  });
  return `/?${params.toString()}`;
}

export function getProposalGovernanceActionMessage(
  actionState: ProposalGovernanceActionState,
): string {
  switch (actionState.reason) {
    case 'closed':
      return 'This proposal is no longer open for voting.';
    case 'body-ineligible':
      return 'Your governance body cannot vote on this proposal type.';
    default:
      return '';
  }
}

export function getProposalGovernanceActionState(
  segment: UserSegment,
  isOpen: boolean,
  proposalType?: string | null,
  paramChanges?: Record<string, unknown> | null,
): ProposalGovernanceActionState {
  const isGovernanceActor = segment === 'drep' || segment === 'spo' || segment === 'cc';
  if (!isGovernanceActor) {
    return { isGovernanceActor: false, canVote: false, reason: 'not-governance-actor' };
  }

  if (!isOpen) {
    return { isGovernanceActor: true, canVote: false, reason: 'closed' };
  }

  const effectiveType = proposalType ?? 'InfoAction';
  const voterBody = segment === 'spo' ? 'spo' : segment === 'cc' ? 'cc' : 'drep';
  const canVote = canBodyVote(voterBody, effectiveType, paramChanges);

  return {
    isGovernanceActor: true,
    canVote,
    reason: canVote ? 'eligible' : 'body-ineligible',
  };
}
