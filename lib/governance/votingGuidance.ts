import { resolveProtocolParameterGroups, type ParameterGroup } from '@/lib/governanceThresholds';
import {
  getIneligibilityNote,
  getVotingBodies,
  type GovernanceBody,
} from '@/lib/governance/votingBodies';

type DraftTypeSpecific = Record<string, unknown> | null | undefined;

export interface GovernanceVotingGuidance {
  bodies: GovernanceBody[];
  bodiesCompact: string;
  bodiesSentence: string;
  requirementsSummary: string;
  thresholdSummary: string;
  postSubmissionSummary: string;
}

const COMPACT_BODY_LABELS: Record<GovernanceBody, string> = {
  drep: 'DReps',
  spo: 'SPOs',
  cc: 'Constitutional Committee',
};

const SENTENCE_BODY_LABELS: Record<GovernanceBody, string> = {
  drep: 'DReps',
  spo: 'SPOs',
  cc: 'the Constitutional Committee',
};

const REQUIREMENT_LABELS: Record<GovernanceBody, string> = {
  drep: 'DRep approval',
  spo: 'SPO approval',
  cc: 'Constitutional Committee confirmation',
};

const PARAMETER_GROUP_LABELS: Record<ParameterGroup, string> = {
  network: 'network',
  economic: 'economic',
  technical: 'technical',
  governance: 'governance',
};

function formatList(items: string[], conjunction: 'and' | 'or' = 'and'): string {
  if (items.length === 0) {
    return '';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} ${conjunction} ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

function formatBodies(
  bodies: GovernanceBody[],
  labels: Record<GovernanceBody, string>,
  separator: 'sentence' | 'compact',
): string {
  const bodyLabels = bodies.map((body) => labels[body]);
  return separator === 'compact' ? bodyLabels.join(' + ') : formatList(bodyLabels);
}

function getRequirementSummary(
  proposalType: string,
  bodies: GovernanceBody[],
  paramChanges?: Record<string, unknown> | null,
): string {
  if (proposalType === 'InfoAction') {
    return 'This is an advisory action. DReps, SPOs, and the Constitutional Committee can all signal on it, but it does not enact changes on-chain.';
  }

  const base = `Requires ${formatList(bodies.map((body) => REQUIREMENT_LABELS[body]))}.`;
  const ineligibilityNote = getIneligibilityNote(proposalType, paramChanges);

  return ineligibilityNote ? `${base} ${ineligibilityNote}` : base;
}

function getThresholdLabel(
  proposalType: string,
  paramChanges?: Record<string, unknown> | null,
): string {
  switch (proposalType) {
    case 'TreasuryWithdrawals':
      return 'treasury withdrawal threshold';
    case 'ParameterChange': {
      const groups = resolveProtocolParameterGroups(paramChanges);
      if (groups.length === 0) {
        return 'applicable protocol-parameter threshold';
      }

      if (groups.length === 1) {
        return `${PARAMETER_GROUP_LABELS[groups[0]]} parameter threshold`;
      }

      return `strictest applicable ${formatList(
        groups.map((group) => PARAMETER_GROUP_LABELS[group]),
        'or',
      )} parameter threshold`;
    }
    case 'HardForkInitiation':
      return 'hard-fork initiation threshold';
    case 'NoConfidence':
      return 'no-confidence threshold';
    case 'NewCommittee':
    case 'NewConstitutionalCommittee':
      return 'committee update threshold';
    case 'NewConstitution':
    case 'UpdateConstitution':
      return 'constitution update threshold';
    default:
      return 'on-chain governance threshold';
  }
}

function getThresholdSummary(
  proposalType: string,
  bodies: GovernanceBody[],
  paramChanges?: Record<string, unknown> | null,
): string {
  if (proposalType === 'InfoAction') {
    return 'Advisory signal only. This action does not enact changes on-chain.';
  }

  const base = `Must satisfy the ${getThresholdLabel(proposalType, paramChanges)} with ${formatList(bodies.map((body) => REQUIREMENT_LABELS[body]))}.`;

  if (proposalType === 'ParameterChange' && !bodies.includes('spo')) {
    return `${base} SPOs only vote on security-relevant parameter updates.`;
  }

  return base;
}

export function getDraftParamChanges(
  typeSpecific?: DraftTypeSpecific,
): Record<string, unknown> | null {
  if (!typeSpecific) {
    return null;
  }

  const rawParamChanges = typeSpecific.paramChanges;
  if (rawParamChanges && typeof rawParamChanges === 'object' && !Array.isArray(rawParamChanges)) {
    return rawParamChanges as Record<string, unknown>;
  }

  const parameterName =
    typeof typeSpecific.parameterName === 'string' ? typeSpecific.parameterName : null;
  if (!parameterName) {
    return null;
  }

  return {
    [parameterName]: typeSpecific.proposedValue ?? true,
  };
}

export function getVotingGuidance(
  proposalType: string,
  paramChanges?: Record<string, unknown> | null,
): GovernanceVotingGuidance {
  const bodies = getVotingBodies(proposalType, paramChanges);

  return {
    bodies,
    bodiesCompact: formatBodies(bodies, COMPACT_BODY_LABELS, 'compact'),
    bodiesSentence: formatBodies(bodies, SENTENCE_BODY_LABELS, 'sentence'),
    requirementsSummary: getRequirementSummary(proposalType, bodies, paramChanges),
    thresholdSummary: getThresholdSummary(proposalType, bodies, paramChanges),
    postSubmissionSummary:
      proposalType === 'InfoAction'
        ? `${formatBodies(bodies, SENTENCE_BODY_LABELS, 'sentence')} can all signal on your proposal.`
        : `${formatBodies(bodies, SENTENCE_BODY_LABELS, 'sentence')} will review and vote on your proposal.`,
  };
}

export function getDraftVotingGuidance(
  proposalType: string,
  typeSpecific?: DraftTypeSpecific,
): GovernanceVotingGuidance {
  return getVotingGuidance(proposalType, getDraftParamChanges(typeSpecific));
}
