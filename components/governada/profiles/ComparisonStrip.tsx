'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { TierBadge } from '@/components/governada/cards/TierBadge';
import { tierKey, type TierKey } from '@/components/governada/cards/tierStyles';

/* ─── Types ───────────────────────────────────────────── */

interface DRepComparisonData {
  drepId: string;
  name: string;
  alignment: number | null;
  participationRate: number;
  tier: string;
}

export interface ComparisonStripProps {
  /** The DRep being viewed */
  viewingDrep: DRepComparisonData;
  /** The comparison DRep (current delegation or top match) */
  comparisonDrep: DRepComparisonData | null;
  /** What kind of comparison this is */
  comparisonType: 'current_drep' | 'top_match' | null;
  className?: string;
}

/* ─── Helpers ─────────────────────────────────────────── */

/**
 * A thin progress bar rendered as a div.
 * Width = value%, colored green if this value is the "better" one.
 */
function MetricBar({
  value,
  isBetter,
  label,
}: {
  value: number;
  isBetter: boolean;
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-1">
        <span
          className={cn(
            'text-sm tabular-nums font-medium',
            isBetter ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        >
          {value}%
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isBetter ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-muted-foreground/40',
          )}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * A single metric row comparing two values.
 */
function MetricRow({
  label,
  viewingValue,
  comparisonValue,
  viewingName,
  comparisonName,
}: {
  label: string;
  viewingValue: number;
  comparisonValue: number;
  viewingName: string;
  comparisonName: string;
}) {
  const viewingIsBetter = viewingValue >= comparisonValue;
  const comparisonIsBetter = comparisonValue >= viewingValue;
  // When equal, both get neutral styling (neither is "better")
  const tied = viewingValue === comparisonValue;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <MetricBar
          value={viewingValue}
          isBetter={!tied && viewingIsBetter}
          label={`${viewingName} ${label.toLowerCase()}`}
        />
        <span className="text-[10px] text-muted-foreground shrink-0">vs</span>
        <MetricBar
          value={comparisonValue}
          isBetter={!tied && comparisonIsBetter}
          label={`${comparisonName} ${label.toLowerCase()}`}
        />
      </div>
    </div>
  );
}

/* ─── Component ───────────────────────────────────────── */

export function ComparisonStrip({
  viewingDrep,
  comparisonDrep,
  comparisonType,
  className,
}: ComparisonStripProps) {
  const { depth, isAtLeast } = useGovernanceDepth();

  // Don't render if no comparison data or hands_off depth
  if (!comparisonDrep || !comparisonType) return null;
  if (depth === 'hands_off') return null;

  const headerLabel =
    comparisonType === 'current_drep'
      ? `vs. Your Current DRep: ${comparisonDrep.name}`
      : `vs. Your #1 Match: ${comparisonDrep.name}`;

  const showParticipationAndTier = isAtLeast('engaged');
  const showComparisonLink = isAtLeast('deep');

  const comparisonUrl = `/compare?dreps=${encodeURIComponent(viewingDrep.drepId)},${encodeURIComponent(comparisonDrep.drepId)}`;

  const viewingTier = tierKey(viewingDrep.tier) as TierKey;
  const comparisonTier = tierKey(comparisonDrep.tier) as TierKey;

  // Determine if alignment values are available
  const hasAlignment = viewingDrep.alignment !== null && comparisonDrep.alignment !== null;

  return (
    <div className={cn('rounded-xl border border-border bg-muted/30 p-4', className)}>
      {/* Header */}
      <p className="text-sm font-medium text-muted-foreground mb-3">{headerLabel}</p>

      <div className="space-y-3">
        {/* Alignment comparison — always shown at informed+ if available */}
        {hasAlignment && (
          <MetricRow
            label="Alignment"
            viewingValue={viewingDrep.alignment!}
            comparisonValue={comparisonDrep.alignment!}
            viewingName={viewingDrep.name}
            comparisonName={comparisonDrep.name}
          />
        )}

        {/* Participation + Tier — only at engaged+ */}
        {showParticipationAndTier && (
          <>
            <MetricRow
              label="Participation"
              viewingValue={Math.round(viewingDrep.participationRate)}
              comparisonValue={Math.round(comparisonDrep.participationRate)}
              viewingName={viewingDrep.name}
              comparisonName={comparisonDrep.name}
            />

            {/* Tier comparison */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Tier</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <TierBadge tier={viewingTier} />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">vs</span>
                <div className="flex-1 min-w-0">
                  <TierBadge tier={comparisonTier} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Link to full comparison — deep only */}
      {showComparisonLink && (
        <Link
          href={comparisonUrl}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View full comparison
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
