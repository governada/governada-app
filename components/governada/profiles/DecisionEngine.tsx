'use client';

import { cn } from '@/lib/utils';
import { Target } from 'lucide-react';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { DepthGate } from '@/components/providers/DepthGate';
import { AlignmentCard } from './AlignmentCard';
import { ComparisonStrip } from './ComparisonStrip';
import { DelegationSimulationView } from './DelegationSimulationView';
import type { AlignmentSummary } from '@/lib/matching/proposalAlignment';
import type { DelegationSimulation } from '@/lib/matching/delegationSimulation';

/* ─── Types ───────────────────────────────────────────── */

interface DecisionEngineProps {
  drepId: string;
  drepName: string;
  alignment: AlignmentSummary;
  simulation: DelegationSimulation | null;
  comparisonDrep: {
    drepId: string;
    name: string;
    alignment: number | null;
    participationRate: number;
    tier: string;
  } | null;
  comparisonType: 'current_drep' | 'top_match' | null;
  /** Viewing DRep data for the comparison strip */
  viewingDrepData: {
    drepId: string;
    name: string;
    alignment: number | null;
    participationRate: number;
    tier: string;
  };
  className?: string;
}

/* ─── Depth-based card limits ─────────────────────────── */

function getCardLimits(isAtLeast: (t: 'hands_off' | 'informed' | 'engaged' | 'deep') => boolean): {
  agreements: number;
  disagreements: number;
} {
  if (isAtLeast('deep')) return { agreements: Infinity, disagreements: Infinity };
  if (isAtLeast('engaged')) return { agreements: 3, disagreements: 2 };
  if (isAtLeast('informed')) return { agreements: 2, disagreements: 2 };
  // hands_off: show alignment header + 1 top agreement only
  return { agreements: 1, disagreements: 0 };
}

/* ─── Component ───────────────────────────────────────── */

export function DecisionEngine({
  drepId: _drepId,
  drepName: _drepName,
  alignment,
  simulation,
  comparisonDrep,
  comparisonType,
  viewingDrepData,
  className,
}: DecisionEngineProps) {
  const { isAtLeast } = useGovernanceDepth();
  const limits = getCardLimits(isAtLeast);

  const visibleAgreements = alignment.topAgreements.slice(
    0,
    limits.agreements === Infinity ? undefined : limits.agreements,
  );
  const visibleDisagreements = alignment.topDisagreements.slice(
    0,
    limits.disagreements === Infinity ? undefined : limits.disagreements,
  );

  return (
    <div className={cn('space-y-5', className)}>
      {/* ── Alignment Header ── */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Alignment with You
          </span>
        </div>

        {alignment.overallAlignment !== null && (
          <div className="space-y-1">
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {alignment.overallAlignment}%{' '}
              <span className="text-base font-normal text-muted-foreground">aligned with you</span>
            </p>
            <p className="text-xs text-muted-foreground">{alignment.confidenceLabel}</p>
          </div>
        )}

        {/* Narrative */}
        {alignment.narrative && (
          <p className="text-sm text-muted-foreground leading-relaxed">{alignment.narrative}</p>
        )}

        {/* ── Agreement Cards ── */}
        {visibleAgreements.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Where you agree
            </p>
            <div className="space-y-2">
              {visibleAgreements.map((result) => (
                <AlignmentCard key={result.proposalId} result={result} type="agreement" />
              ))}
            </div>
          </div>
        )}

        {/* ── Disagreement Cards ── */}
        {visibleDisagreements.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Where you differ
            </p>
            <div className="space-y-2">
              {visibleDisagreements.map((result) => (
                <AlignmentCard key={result.proposalId} result={result} type="disagreement" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Comparison Strip ── */}
      <DepthGate minDepth="informed">
        <ComparisonStrip
          viewingDrep={viewingDrepData}
          comparisonDrep={comparisonDrep}
          comparisonType={comparisonType}
        />
      </DepthGate>

      {/* ── Delegation Simulation ── */}
      {simulation && simulation.totalProposals > 0 && (
        <DepthGate minDepth="engaged">
          <DelegationSimulationView simulation={simulation} />
        </DepthGate>
      )}
    </div>
  );
}
