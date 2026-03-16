'use client';

interface GovernanceClimatePreviewProps {
  activeProposals: number;
  activeDReps: number;
  totalDelegators: number;
  /** Total registered DReps — used for relative participation rate. */
  totalRegisteredDReps?: number;
  /** Total circulating ADA delegated — used for relative delegation coverage. */
  totalDelegatedAda?: number;
  /** Total circulating ADA supply — used with totalDelegatedAda for coverage ratio. */
  circulatingSupplyAda?: number;
}

type ClimateStatus = 'Good' | 'Fair' | 'Needs attention';

/**
 * GovernanceClimatePreview — A single plain-English sentence about governance health.
 *
 * Gives anonymous visitors a free taste of Governada's interpreted intelligence.
 * Derives a simple health assessment from pulse data without requiring
 * authentication or wallet connection.
 */
export function GovernanceClimatePreview({
  activeProposals,
  activeDReps,
  totalDelegators,
  totalRegisteredDReps,
  totalDelegatedAda,
  circulatingSupplyAda,
}: GovernanceClimatePreviewProps) {
  const { status, detail } = assessClimate(activeProposals, activeDReps, totalDelegators, {
    totalRegisteredDReps,
    totalDelegatedAda,
    circulatingSupplyAda,
  });

  const statusColor: Record<ClimateStatus, string> = {
    Good: 'text-emerald-400/90',
    Fair: 'text-amber-400/90',
    'Needs attention': 'text-red-400/90',
  };

  return (
    <p className="text-xs text-muted-foreground/70 text-center">
      Governance health: <span className={`font-medium ${statusColor[status]}`}>{status}</span>.{' '}
      {detail}
    </p>
  );
}

/**
 * Derive a simple governance health assessment from pulse data.
 *
 * Uses relative thresholds when totals are available (participation rate
 * as % of registered DReps, delegation coverage as % of circulating ADA).
 * Falls back to future-proofed absolute thresholds when relative data
 * isn't provided. Absolute fallbacks should be reviewed periodically as
 * the ecosystem grows.
 */
function assessClimate(
  activeProposals: number,
  activeDReps: number,
  totalDelegators: number,
  opts?: {
    totalRegisteredDReps?: number;
    totalDelegatedAda?: number;
    circulatingSupplyAda?: number;
  },
): { status: ClimateStatus; detail: string } {
  // Edge case: no data available
  if (activeProposals === 0 && activeDReps === 0 && totalDelegators === 0) {
    return {
      status: 'Fair',
      detail: 'Governance data is being refreshed.',
    };
  }

  const hasActiveProposals = activeProposals > 0;

  // Relative participation: % of registered DReps that are active
  // Strong = >60%, Moderate = 40-60%, Weak = <40%
  // Fallback absolute thresholds: 100 DReps = strong, 30 = moderate
  // (review these periodically as the ecosystem grows)
  const STRONG_DREP_ABSOLUTE = 100;
  const MODERATE_DREP_ABSOLUTE = 30;
  let hasStrongParticipation: boolean;
  let hasModerateParticipation: boolean;
  if (opts?.totalRegisteredDReps && opts.totalRegisteredDReps > 0) {
    const participationRate = activeDReps / opts.totalRegisteredDReps;
    hasStrongParticipation = participationRate >= 0.6;
    hasModerateParticipation = participationRate >= 0.4;
  } else {
    hasStrongParticipation = activeDReps >= STRONG_DREP_ABSOLUTE;
    hasModerateParticipation = activeDReps >= MODERATE_DREP_ABSOLUTE;
  }

  // Relative delegation coverage: delegated ADA as % of circulating supply
  // Strong = >50%, Fallback absolute: 5000 delegators
  // (review these periodically as the ecosystem grows)
  const STRONG_DELEGATOR_ABSOLUTE = 5000;
  let hasStrongDelegation: boolean;
  if (
    opts?.totalDelegatedAda != null &&
    opts?.circulatingSupplyAda != null &&
    opts.circulatingSupplyAda > 0
  ) {
    hasStrongDelegation = opts.totalDelegatedAda / opts.circulatingSupplyAda >= 0.5;
  } else {
    hasStrongDelegation = totalDelegators >= STRONG_DELEGATOR_ABSOLUTE;
  }

  // Good: strong participation across the board
  if (hasActiveProposals && hasStrongParticipation && hasStrongDelegation) {
    return {
      status: 'Good',
      detail: 'Participation is high and proposals are being actively decided.',
    };
  }

  // Good: strong DRep participation even if delegation is moderate
  if (hasActiveProposals && hasStrongParticipation) {
    return {
      status: 'Good',
      detail: `${activeDReps} representatives are actively voting on proposals.`,
    };
  }

  // Fair: proposals exist but participation could be better
  if (hasActiveProposals && !hasModerateParticipation) {
    return {
      status: 'Fair',
      detail: 'Proposals are open but representative participation could be stronger.',
    };
  }

  // Good-ish: moderate participation with proposals
  if (hasActiveProposals && hasModerateParticipation) {
    return {
      status: 'Good',
      detail: `${activeDReps} representatives are voting on open proposals.`,
    };
  }

  // Fair: no active proposals (between voting periods)
  if (!hasActiveProposals && hasStrongParticipation) {
    return {
      status: 'Good',
      detail: `${activeDReps} representatives are ready for the next voting period.`,
    };
  }

  return {
    status: 'Fair',
    detail: 'The governance ecosystem is between active voting periods.',
  };
}
