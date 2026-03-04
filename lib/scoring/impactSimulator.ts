/**
 * Score Impact Simulator — predicts score changes from hypothetical actions.
 * Fast (<200ms) — operates on cached current scores + simple delta estimation.
 * Supports both DRep and SPO entities.
 */

import { PILLAR_WEIGHTS } from './types';
import { SPO_PILLAR_WEIGHTS } from './spoScore';
import { computeTierProgress, type TierProgress } from './tiers';

export type SimulatedActionType =
  | 'vote_yes'
  | 'vote_no'
  | 'vote_abstain'
  | 'provide_rationale'
  | 'update_profile';

export interface SimulatedAction {
  type: SimulatedActionType;
  proposalKey?: string;
  proposalImportance?: number;
  isCloseMargin?: boolean;
}

export interface CurrentScoreState {
  composite: number;
  participationPct: number;
  consistencyPct: number;
  reliabilityPct: number;
  governanceIdentityPct: number;
  engagementQualityPct?: number;
  effectiveParticipationPct?: number;
  voteCount: number;
  totalProposals: number;
}

export interface ImpactResult {
  currentScore: number;
  predictedScore: number;
  delta: number;
  pillarDeltas: PillarDelta[];
  tierProgress: TierProgress;
  predictedTierProgress: TierProgress;
}

export interface PillarDelta {
  pillar: string;
  currentPct: number;
  predictedPct: number;
  delta: number;
}

/**
 * Simulate score impact for DRep or SPO from proposed actions.
 * Uses heuristic estimation rather than recomputing full pipeline.
 */
export function simulateScoreImpact(
  entityType: 'drep' | 'spo',
  currentState: CurrentScoreState,
  actions: SimulatedAction[],
): ImpactResult {
  const weights = entityType === 'drep' ? DREP_WEIGHTS : SPO_WEIGHTS;

  let participationDelta = 0;
  let reliabilityDelta = 0;
  let engagementDelta = 0;
  let identityDelta = 0;

  for (const action of actions) {
    const importance = action.proposalImportance ?? 1;
    const marginBonus = action.isCloseMargin ? 1.5 : 1;

    switch (action.type) {
      case 'vote_yes':
      case 'vote_no': {
        const participationGain = estimateParticipationGain(
          currentState.voteCount,
          currentState.totalProposals,
          importance,
          marginBonus,
        );
        participationDelta += participationGain;
        reliabilityDelta += 1;
        break;
      }
      case 'vote_abstain': {
        const participationGain = estimateParticipationGain(
          currentState.voteCount,
          currentState.totalProposals,
          importance * 0.5,
          1,
        );
        participationDelta += participationGain;
        break;
      }
      case 'provide_rationale': {
        engagementDelta += estimateRationaleGain(currentState.voteCount);
        break;
      }
      case 'update_profile': {
        identityDelta += estimateProfileGain(currentState.governanceIdentityPct);
        break;
      }
    }
  }

  const pillarDeltas: PillarDelta[] = [];

  if (entityType === 'drep') {
    pillarDeltas.push(
      {
        pillar: 'Engagement Quality',
        currentPct: currentState.engagementQualityPct ?? currentState.participationPct,
        predictedPct: clamp(
          (currentState.engagementQualityPct ?? currentState.participationPct) + engagementDelta,
        ),
        delta: engagementDelta,
      },
      {
        pillar: 'Effective Participation',
        currentPct: currentState.effectiveParticipationPct ?? currentState.participationPct,
        predictedPct: clamp(
          (currentState.effectiveParticipationPct ?? currentState.participationPct) +
            participationDelta,
        ),
        delta: participationDelta,
      },
      {
        pillar: 'Reliability',
        currentPct: currentState.reliabilityPct,
        predictedPct: clamp(currentState.reliabilityPct + reliabilityDelta),
        delta: reliabilityDelta,
      },
      {
        pillar: 'Governance Identity',
        currentPct: currentState.governanceIdentityPct,
        predictedPct: clamp(currentState.governanceIdentityPct + identityDelta),
        delta: identityDelta,
      },
    );
  } else {
    pillarDeltas.push(
      {
        pillar: 'Participation',
        currentPct: currentState.participationPct,
        predictedPct: clamp(currentState.participationPct + participationDelta),
        delta: participationDelta,
      },
      {
        pillar: 'Consistency',
        currentPct: currentState.consistencyPct,
        predictedPct: currentState.consistencyPct,
        delta: 0,
      },
      {
        pillar: 'Reliability',
        currentPct: currentState.reliabilityPct,
        predictedPct: clamp(currentState.reliabilityPct + reliabilityDelta),
        delta: reliabilityDelta,
      },
      {
        pillar: 'Governance Identity',
        currentPct: currentState.governanceIdentityPct,
        predictedPct: clamp(currentState.governanceIdentityPct + identityDelta),
        delta: identityDelta,
      },
    );
  }

  const predictedScore = Math.round(
    pillarDeltas.reduce((sum, p, idx) => {
      const weight = Object.values(weights)[idx] ?? 0.25;
      return sum + p.predictedPct * weight;
    }, 0),
  );

  return {
    currentScore: currentState.composite,
    predictedScore: clamp(predictedScore),
    delta: clamp(predictedScore) - currentState.composite,
    pillarDeltas,
    tierProgress: computeTierProgress(currentState.composite),
    predictedTierProgress: computeTierProgress(clamp(predictedScore)),
  };
}

const DREP_WEIGHTS = {
  engagementQuality: PILLAR_WEIGHTS.engagementQuality,
  effectiveParticipation: PILLAR_WEIGHTS.effectiveParticipation,
  reliability: PILLAR_WEIGHTS.reliability,
  governanceIdentity: PILLAR_WEIGHTS.governanceIdentity,
};

const SPO_WEIGHTS = {
  participation: SPO_PILLAR_WEIGHTS.participation,
  consistency: SPO_PILLAR_WEIGHTS.consistency,
  reliability: SPO_PILLAR_WEIGHTS.reliability,
  governanceIdentity: SPO_PILLAR_WEIGHTS.governanceIdentity,
};

function estimateParticipationGain(
  voteCount: number,
  totalProposals: number,
  importance: number,
  marginBonus: number,
): number {
  if (totalProposals === 0) return 0;
  const currentRate = voteCount / totalProposals;
  const newRate = (voteCount + 1) / totalProposals;
  const rawDelta = (newRate - currentRate) * 100 * importance * marginBonus;
  return Math.round(rawDelta * 10) / 10;
}

function estimateRationaleGain(voteCount: number): number {
  if (voteCount === 0) return 5;
  return Math.max(1, Math.round(100 / voteCount));
}

function estimateProfileGain(currentIdentityPct: number): number {
  if (currentIdentityPct >= 90) return 1;
  if (currentIdentityPct >= 70) return 3;
  if (currentIdentityPct >= 50) return 5;
  return 8;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
