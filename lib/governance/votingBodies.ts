/**
 * Governance body eligibility per proposal type.
 *
 * CIP-1694 defines which governance bodies can vote on each proposal type.
 * This module is the single source of truth — import from here instead of
 * duplicating the lists in route handlers or components.
 */

import { isSecurityRelevantParameterUpdate } from '@/lib/governanceThresholds';

export type GovernanceBody = 'drep' | 'spo' | 'cc';

const ALL_BODIES: GovernanceBody[] = ['drep', 'spo', 'cc'];
const DREP_AND_CC: GovernanceBody[] = ['drep', 'cc'];
const DREP_AND_SPO: GovernanceBody[] = ['drep', 'spo'];

function getProposalTypeLabel(proposalType: string): string {
  switch (proposalType) {
    case 'TreasuryWithdrawals':
      return 'Treasury Withdrawals';
    case 'HardForkInitiation':
      return 'Hard Fork Initiation';
    case 'NoConfidence':
      return 'No Confidence actions';
    case 'NewCommittee':
    case 'NewConstitutionalCommittee':
      return 'Update Committee actions';
    case 'NewConstitution':
    case 'UpdateConstitution':
      return 'Constitution updates';
    case 'ParameterChange':
      return 'Parameter Updates';
    case 'InfoAction':
      return 'Info actions';
    default:
      return proposalType;
  }
}

/**
 * Return the governance bodies eligible to vote on a given proposal type.
 * DReps always vote. SPOs and CC are conditionally included.
 */
export function getVotingBodies(
  proposalType: string,
  paramChanges?: Record<string, unknown> | null,
): GovernanceBody[] {
  switch (proposalType) {
    case 'TreasuryWithdrawals':
      return DREP_AND_CC;
    case 'ParameterChange':
      return isSecurityRelevantParameterUpdate(paramChanges) ? ALL_BODIES : DREP_AND_CC;
    case 'HardForkInitiation':
      return ALL_BODIES;
    case 'NoConfidence':
    case 'NewCommittee':
    case 'NewConstitutionalCommittee':
      return DREP_AND_SPO;
    case 'NewConstitution':
    case 'UpdateConstitution':
      return DREP_AND_CC;
    case 'InfoAction':
      return ALL_BODIES;
    default:
      return ['drep'];
  }
}

/** Check if a specific body can vote on this proposal type */
export function canBodyVote(
  body: GovernanceBody,
  proposalType: string,
  paramChanges?: Record<string, unknown> | null,
): boolean {
  return getVotingBodies(proposalType, paramChanges).includes(body);
}

/**
 * Human-readable note explaining why certain governance bodies
 * are not eligible to vote on a given proposal type.
 * Returns null when all bodies are eligible.
 */
export function getIneligibilityNote(
  proposalType: string,
  paramChanges?: Record<string, unknown> | null,
): string | null {
  if (proposalType === 'ParameterChange' && !isSecurityRelevantParameterUpdate(paramChanges)) {
    return 'SPOs only vote on security-relevant parameter updates.';
  }

  const eligibleBodies = new Set(getVotingBodies(proposalType, paramChanges));
  const excludedBodies = ALL_BODIES.filter((body) => !eligibleBodies.has(body));

  if (excludedBodies.length === 0) {
    return null;
  }

  const label = getProposalTypeLabel(proposalType);
  if (excludedBodies.length === 2) {
    return `Only DReps are eligible to vote on ${label}.`;
  }

  if (excludedBodies[0] === 'spo') {
    return `SPOs are not eligible to vote on ${label}.`;
  }

  if (excludedBodies[0] === 'cc') {
    return `CC members are not eligible to vote on ${label}.`;
  }

  return `${excludedBodies[0]} voters are not eligible to vote on ${label}.`;
}
