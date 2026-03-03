/**
 * Shared proposal priority classification and educational content.
 * Used by both the DRep Governance Inbox and ADA Holder proposals page.
 */

const CRITICAL_TYPES = [
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'NewConstitution',
  'UpdateConstitution',
];

export type ProposalPriority = 'critical' | 'important' | 'standard';

export function getProposalPriority(proposalType: string): ProposalPriority {
  if (CRITICAL_TYPES.includes(proposalType)) return 'critical';
  if (proposalType === 'ParameterChange') return 'important';
  return 'standard';
}

export const PRIORITY_STYLES: Record<ProposalPriority, { label: string; className: string }> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  important: {
    label: 'Important',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  standard: {
    label: 'Standard',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export type ProposalStatus = 'open' | 'ratified' | 'enacted' | 'dropped' | 'expired';

export function getProposalStatus(lifecycle: {
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
}): ProposalStatus {
  if (lifecycle.enactedEpoch != null) return 'enacted';
  if (lifecycle.ratifiedEpoch != null) return 'ratified';
  if (lifecycle.droppedEpoch != null) return 'dropped';
  if (lifecycle.expiredEpoch != null) return 'expired';
  return 'open';
}

export const STATUS_STYLES: Record<ProposalStatus, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-500/30',
  },
  ratified: {
    label: 'Ratified',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-500/30',
  },
  enacted: {
    label: 'Enacted',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-500/30',
  },
  dropped: {
    label: 'Dropped',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-500/30',
  },
  expired: {
    label: 'Expired',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 border-slate-500/30',
  },
};

export const TYPE_EXPLAINERS: Record<string, string> = {
  TreasuryWithdrawals:
    'Requests ADA from the community treasury to fund a project or initiative. Impacts how community funds are spent.',
  ParameterChange:
    'Proposes changes to blockchain protocol parameters like fees, block size, or staking rewards. Affects how the network operates.',
  HardForkInitiation:
    'Initiates a major protocol upgrade. This is a critical, irreversible change to how Cardano works.',
  InfoAction:
    'A non-binding poll or information request. Does not change the protocol but gauges community sentiment.',
  NoConfidence:
    'A vote of no confidence in the current Constitutional Committee. If passed, the committee is dissolved.',
  NewCommittee:
    'Proposes a new Constitutional Committee to oversee governance. Directly impacts who governs the chain.',
  NewConstitutionalCommittee:
    'Proposes a new Constitutional Committee to oversee governance. Directly impacts who governs the chain.',
  NewConstitution:
    'Proposes an entirely new constitution for Cardano governance. A foundational change.',
  UpdateConstitution:
    'Proposes amendments to the existing Cardano constitution. Changes the rules of governance.',
};
