'use client';

interface GovernanceClimatePreviewProps {
  activeProposals: number;
  activeDReps: number;
  totalDelegators: number;
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
}: GovernanceClimatePreviewProps) {
  const { status, detail } = assessClimate(activeProposals, activeDReps, totalDelegators);

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
 * Heuristics:
 * - High DRep participation (50+) + active proposals = Good
 * - Low DRep count or no proposals = Fair
 * - No data at all = Needs attention (graceful edge case)
 */
function assessClimate(
  activeProposals: number,
  activeDReps: number,
  totalDelegators: number,
): { status: ClimateStatus; detail: string } {
  // Edge case: no data available
  if (activeProposals === 0 && activeDReps === 0 && totalDelegators === 0) {
    return {
      status: 'Fair',
      detail: 'Governance data is being refreshed.',
    };
  }

  const hasActiveProposals = activeProposals > 0;
  const hasStrongParticipation = activeDReps >= 50;
  const hasStrongDelegation = totalDelegators >= 1000;

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
  if (hasActiveProposals && !hasStrongParticipation) {
    return {
      status: 'Fair',
      detail: 'Proposals are open but representative participation could be stronger.',
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
