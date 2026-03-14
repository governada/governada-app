/**
 * Governance body eligibility per proposal type.
 *
 * CIP-1694 defines which governance bodies can vote on each proposal type.
 * This module is the single source of truth — import from here instead of
 * duplicating the lists in route handlers or components.
 */

export type GovernanceBody = 'drep' | 'spo' | 'cc';

/** Proposal types where ONLY DReps vote (SPOs and CC are excluded) */
export const DREP_ONLY_TYPES = ['TreasuryWithdrawals', 'InfoAction'];

/** Proposal types that accept SPO votes */
export const SPO_VOTABLE_TYPES = [
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'NewConstitution',
  'UpdateConstitution',
];

/** Proposal types that accept CC votes */
export const CC_VOTABLE_TYPES = [
  'ParameterChange',
  'HardForkInitiation',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'NewConstitution',
  'UpdateConstitution',
];

/**
 * Return the governance bodies eligible to vote on a given proposal type.
 * DReps always vote. SPOs and CC are conditionally included.
 */
export function getVotingBodies(proposalType: string): GovernanceBody[] {
  const bodies: GovernanceBody[] = ['drep'];
  if (SPO_VOTABLE_TYPES.includes(proposalType)) bodies.push('spo');
  if (CC_VOTABLE_TYPES.includes(proposalType)) bodies.push('cc');
  return bodies;
}

/** Check if a specific body can vote on this proposal type */
export function canBodyVote(body: GovernanceBody, proposalType: string): boolean {
  if (body === 'drep') return true;
  if (body === 'spo') return SPO_VOTABLE_TYPES.includes(proposalType);
  if (body === 'cc') return CC_VOTABLE_TYPES.includes(proposalType);
  return false;
}

/**
 * Human-readable note explaining why certain governance bodies
 * are not eligible to vote on a given proposal type.
 * Returns null when all bodies are eligible.
 */
export function getIneligibilityNote(proposalType: string): string | null {
  if (DREP_ONLY_TYPES.includes(proposalType)) {
    const label = proposalType === 'TreasuryWithdrawals' ? 'Treasury Withdrawals' : 'Info Actions';
    return `SPOs and CC members are not eligible to vote on ${label}.`;
  }
  return null;
}
