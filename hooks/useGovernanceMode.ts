'use client';

/**
 * useGovernanceMode — Returns the current governance temporal mode.
 *
 * Modes:
 * - 'urgent': Multiple proposals expiring within 48h, or epoch ending with uncast DRep votes
 *             (urgency score >= 70)
 * - 'active':  Active proposals in voting, normal governance activity
 *             (urgency score 40-69)
 * - 'calm':    No urgent proposals, analysis/research period
 *             (urgency score < 40)
 *
 * TODO: Wire to GET /api/intelligence/governance-state when Phase 4 ships.
 *       Currently defaults to 'active' mode.
 */

export type GovernanceMode = 'urgent' | 'active' | 'calm';

interface UseGovernanceModeResult {
  /** Current governance temporal mode */
  mode: GovernanceMode;
  /** Convenience boolean for urgent state checks */
  isUrgent: boolean;
  /** Convenience boolean for calm state checks */
  isCalm: boolean;
  /** Raw urgency score (0-100). Default: 50 until Phase 4 API ships. */
  urgencyScore: number;
}

/**
 * Derive mode from urgency score.
 */
function scoreToMode(score: number): GovernanceMode {
  if (score >= 70) return 'urgent';
  if (score >= 40) return 'active';
  return 'calm';
}

/**
 * Returns the current governance temporal mode based on governance urgency.
 *
 * Currently returns a static 'active' mode. Will be wired to the
 * governance state API endpoint when Phase 4 intelligence panel ships.
 */
export function useGovernanceMode(): UseGovernanceModeResult {
  // TODO: Wire to GET /api/intelligence/governance-state when Phase 4 ships.
  // For now, default to 'active' (urgency score 50).
  const urgencyScore = 50;
  const mode = scoreToMode(urgencyScore);

  return {
    mode,
    isUrgent: mode === 'urgent',
    isCalm: mode === 'calm',
    urgencyScore,
  };
}
