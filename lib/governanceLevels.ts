export type GovernanceLevel = 'observer' | 'voter' | 'guardian' | 'champion';

export interface LevelDefinition {
  key: GovernanceLevel;
  label: string;
  description: string;
  icon: string;
  color: string;
  requirements: {
    minPollVotes: number;
    minEpochsActive: number;
    requiresDelegation: boolean;
    requiresShare?: boolean;
  };
}

export const GOVERNANCE_LEVELS: LevelDefinition[] = [
  {
    key: 'observer',
    label: 'Observer',
    description: 'Connected and watching governance unfold',
    icon: 'Eye',
    color: 'slate',
    requirements: { minPollVotes: 0, minEpochsActive: 0, requiresDelegation: false },
  },
  {
    key: 'voter',
    label: 'Voter',
    description: 'Actively voicing opinions in polls',
    icon: 'Vote',
    color: 'blue',
    requirements: { minPollVotes: 3, minEpochsActive: 0, requiresDelegation: false },
  },
  {
    key: 'guardian',
    label: 'Guardian',
    description: 'Delegated and consistently engaged',
    icon: 'Shield',
    color: 'amber',
    requirements: { minPollVotes: 10, minEpochsActive: 3, requiresDelegation: true },
  },
  {
    key: 'champion',
    label: 'Champion',
    description: 'A pillar of Cardano governance',
    icon: 'Crown',
    color: 'green',
    requirements: { minPollVotes: 25, minEpochsActive: 10, requiresDelegation: false },
  },
];

const LEVEL_ORDER: GovernanceLevel[] = ['observer', 'voter', 'guardian', 'champion'];

export function checkLevel(
  pollCount: number,
  epochsActive: number,
  isDelegated: boolean,
  _hasShared?: boolean,
): GovernanceLevel {
  let highest: GovernanceLevel = 'observer';

  for (const level of GOVERNANCE_LEVELS) {
    const { minPollVotes, minEpochsActive, requiresDelegation } = level.requirements;
    if (
      pollCount >= minPollVotes &&
      epochsActive >= minEpochsActive &&
      (!requiresDelegation || isDelegated)
    ) {
      highest = level.key;
    }
  }

  return highest;
}

export function getNextLevel(currentLevel: GovernanceLevel): LevelDefinition | null {
  const idx = LEVEL_ORDER.indexOf(currentLevel);
  if (idx === -1 || idx >= LEVEL_ORDER.length - 1) return null;
  return GOVERNANCE_LEVELS[idx + 1];
}

export function getLevelDefinition(level: GovernanceLevel): LevelDefinition {
  return GOVERNANCE_LEVELS.find((l) => l.key === level) || GOVERNANCE_LEVELS[0];
}

export function getLevelProgress(
  currentLevel: GovernanceLevel,
  pollCount: number,
  epochsActive: number,
  isDelegated: boolean,
): { percent: number; nextLabel: string | null; hint: string | null } {
  const next = getNextLevel(currentLevel);
  if (!next) return { percent: 100, nextLabel: null, hint: null };

  const reqs = next.requirements;
  const pollProgress = reqs.minPollVotes > 0 ? Math.min(pollCount / reqs.minPollVotes, 1) : 1;
  const epochProgress =
    reqs.minEpochsActive > 0 ? Math.min(epochsActive / reqs.minEpochsActive, 1) : 1;
  const delegationProgress = reqs.requiresDelegation ? (isDelegated ? 1 : 0) : 1;

  const factors = [pollProgress, epochProgress, delegationProgress];
  const percent = Math.round((factors.reduce((a, b) => a + b, 0) / factors.length) * 100);

  const hints: string[] = [];
  if (pollProgress < 1) hints.push(`${reqs.minPollVotes - pollCount} more poll votes`);
  if (epochProgress < 1) hints.push(`${reqs.minEpochsActive - epochsActive} more active epochs`);
  if (delegationProgress < 1) hints.push('delegate to a DRep');

  return {
    percent,
    nextLabel: next.label,
    hint: hints.length > 0 ? `Need ${hints.join(', ')}` : null,
  };
}
