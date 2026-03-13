/**
 * Governance Rings — computes three ring fill values from existing citizen data.
 *
 * Ring 1 (Delegation Health): How well is your DRep performing?
 *   → DRep composite score normalised 0-1
 *
 * Ring 2 (Representation Coverage): What % of proposals are covered?
 *   → Impact coverage score normalised 0-1
 *
 * Ring 3 (Civic Engagement): Are you actively participating?
 *   → Impact engagement depth score normalised 0-1
 *
 * Governance Pulse: weighted composite of all three rings → 0-100.
 */

import type { GovernanceFootprint } from './governanceFootprint';
import type { ImpactScoreBreakdown } from './citizenImpactScore';

export interface RingValues {
  /** 0-1 fill fraction */
  delegation: number;
  /** 0-1 fill fraction */
  coverage: number;
  /** 0-1 fill fraction */
  engagement: number;
}

export interface GovernanceRingsData {
  rings: RingValues;
  /** 0-100 composite */
  pulse: number;
  /** Color token for pulse badge */
  pulseColor: 'emerald' | 'primary' | 'amber' | 'muted';
  /** One-word pulse label */
  pulseLabel: string;
}

const RING_WEIGHTS = { delegation: 0.4, coverage: 0.35, engagement: 0.25 };

/**
 * Compute ring values from existing footprint + impact data.
 * All inputs are nullable — missing data defaults to 0.
 */
export function computeGovernanceRings(
  footprint: GovernanceFootprint | null | undefined,
  impact: ImpactScoreBreakdown | null | undefined,
): GovernanceRingsData {
  // Ring 1: Delegation Health — DRep score normalised to 0-1
  const drepScore = footprint?.delegationRecord.drepScore ?? 0;
  const delegation = Math.min(Math.max(drepScore / 100, 0), 1);

  // Ring 2: Coverage — impact coverage score (0-25) normalised to 0-1
  const coverageRaw = impact?.coverageScore ?? 0;
  const coverage = Math.min(coverageRaw / 25, 1);

  // Ring 3: Engagement — impact engagement depth score (0-25) normalised to 0-1
  const engagementRaw = impact?.engagementDepthScore ?? 0;
  const engagement = Math.min(engagementRaw / 25, 1);

  const rings: RingValues = { delegation, coverage, engagement };

  // Governance Pulse — weighted composite
  const pulse = Math.round(
    (delegation * RING_WEIGHTS.delegation +
      coverage * RING_WEIGHTS.coverage +
      engagement * RING_WEIGHTS.engagement) *
      100,
  );

  const pulseColor =
    pulse >= 75 ? 'emerald' : pulse >= 50 ? 'primary' : pulse >= 25 ? 'amber' : 'muted';

  const pulseLabel =
    pulse >= 75
      ? 'Thriving'
      : pulse >= 50
        ? 'Healthy'
        : pulse >= 25
          ? 'Growing'
          : 'Getting Started';

  return { rings, pulse, pulseColor, pulseLabel };
}

/**
 * Ring configuration for rendering — labels, colors, descriptions.
 */
export const RING_CONFIG = [
  {
    key: 'delegation' as const,
    label: 'Delegation Health',
    color: '#3b82f6', // blue-500
    trackColor: 'rgba(59, 130, 246, 0.15)',
    description: "Your DRep's performance score",
  },
  {
    key: 'coverage' as const,
    label: 'Representation Coverage',
    color: '#a855f7', // purple-500
    trackColor: 'rgba(168, 85, 247, 0.15)',
    description: 'Proposals covered by your delegation',
  },
  {
    key: 'engagement' as const,
    label: 'Civic Engagement',
    color: '#f59e0b', // amber-500
    trackColor: 'rgba(245, 158, 11, 0.15)',
    description: 'Your active participation in governance',
  },
] as const;
