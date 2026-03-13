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

export const RING_WEIGHTS = { delegation: 0.4, coverage: 0.35, engagement: 0.25 };

/**
 * Compute ring values from raw scores.
 * Shared by both the client-side computation and the Inngest snapshot function.
 *
 * @param drepScore — DRep composite score (0-100)
 * @param coverageScore — impact coverage score (0-25)
 * @param engagementDepthScore — impact engagement depth score (0-25)
 */
export function computeRingValues(
  drepScore: number,
  coverageScore: number,
  engagementDepthScore: number,
): { rings: RingValues; pulse: number } {
  const delegation = Math.min(Math.max(drepScore / 100, 0), 1);
  const coverage = Math.min(coverageScore / 25, 1);
  const engagement = Math.min(engagementDepthScore / 25, 1);

  const pulse = Math.round(
    (delegation * RING_WEIGHTS.delegation +
      coverage * RING_WEIGHTS.coverage +
      engagement * RING_WEIGHTS.engagement) *
      100,
  );

  return { rings: { delegation, coverage, engagement }, pulse };
}

/**
 * Compute ring values from existing footprint + impact data.
 * All inputs are nullable — missing data defaults to 0.
 */
export function computeGovernanceRings(
  footprint: GovernanceFootprint | null | undefined,
  impact: ImpactScoreBreakdown | null | undefined,
): GovernanceRingsData {
  const { rings, pulse } = computeRingValues(
    footprint?.delegationRecord.drepScore ?? 0,
    impact?.coverageScore ?? 0,
    impact?.engagementDepthScore ?? 0,
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
