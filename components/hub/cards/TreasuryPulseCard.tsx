'use client';

import { Landmark, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useTreasuryCurrent, useTreasuryNcl } from '@/hooks/queries';
import { HubCard, HubCardSkeleton, HubCardError, type CardUrgency } from './HubCard';

interface TreasuryCurrentData {
  balance: number;
  epoch: number;
  runwayMonths: number;
  burnRatePerEpoch: number;
  trend: 'growing' | 'shrinking' | 'stable';
  healthScore: number | null;
  pendingCount: number;
  pendingTotalAda: number;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

function getHealthStatus(score: number | null): {
  label: string;
  urgency: CardUrgency;
  dotClass: string;
} {
  if (score === null) {
    return { label: 'Unknown', urgency: 'default', dotClass: 'bg-muted-foreground' };
  }
  if (score >= 70) {
    return { label: 'Healthy', urgency: 'default', dotClass: 'bg-emerald-500' };
  }
  if (score >= 40) {
    return { label: 'Attention', urgency: 'warning', dotClass: 'bg-amber-500' };
  }
  return { label: 'Critical', urgency: 'critical', dotClass: 'bg-red-500' };
}

function formatRunway(months: number): string {
  if (months >= 999) return '10yr+ runway';
  if (months >= 24) return `${Math.floor(months / 12)}yr+ runway`;
  return `${months}mo runway`;
}

/**
 * TreasuryPulseCard — Compact treasury health indicator for the Hub.
 *
 * JTBD: "Is the Cardano treasury in good shape?"
 * Status dot + headline + two key stats. Click to expand narrative.
 * Stewardship framing: community resource, budget utilization, not "you own X".
 */
export function TreasuryPulseCard() {
  const [expanded, setExpanded] = useState(false);

  const {
    data: currentRaw,
    isLoading: currentLoading,
    isError: currentError,
    refetch: refetchCurrent,
  } = useTreasuryCurrent();

  const { data: nclRaw } = useTreasuryNcl();

  if (currentLoading) return <HubCardSkeleton />;
  if (currentError)
    return <HubCardError message="Couldn't load treasury" onRetry={() => refetchCurrent()} />;

  const current = currentRaw as TreasuryCurrentData | undefined;
  if (!current) return null;

  const { label, urgency, dotClass } = getHealthStatus(current.healthScore);
  const ncl = nclRaw as
    | { ncl: { utilizationPct: number; period: { nclAda: number } } | null }
    | undefined;
  const nclPct = ncl?.ncl ? Math.round(ncl.ncl.utilizationPct) : null;

  // Build narrative for expanded state
  const narrativeParts: string[] = [];
  const trendWord =
    current.trend === 'growing'
      ? 'growing'
      : current.trend === 'shrinking'
        ? 'declining'
        : 'stable';
  narrativeParts.push(
    `The Cardano treasury holds ₳${formatAda(current.balance)} and is ${trendWord}.`,
  );
  if (nclPct !== null && ncl?.ncl) {
    narrativeParts.push(
      `${nclPct}% of the ₳${formatAda(ncl.ncl.period.nclAda)} budget period limit has been used.`,
    );
  }
  if (current.pendingCount > 0) {
    narrativeParts.push(
      `${current.pendingCount} proposal${current.pendingCount !== 1 ? 's' : ''} pending, totaling ₳${formatAda(current.pendingTotalAda)}.`,
    );
  }
  const narrative = narrativeParts.join(' ');

  return (
    <HubCard
      href="/governance/treasury"
      urgency={urgency}
      label={`Treasury: ${label}, balance ₳${formatAda(current.balance)}`}
    >
      <div className="space-y-2">
        {/* Header: status dot + headline */}
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Treasury
          </span>
          <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} aria-hidden />
          <span className="text-xs font-semibold text-foreground">{label}</span>
        </div>

        {/* Key stats */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">₳{formatAda(current.balance)}</span>
          {nclPct !== null && (
            <span className="text-xs text-muted-foreground">&middot; {nclPct}% of budget used</span>
          )}
          <span className="text-xs text-muted-foreground">
            &middot; {formatRunway(current.runwayMonths)}
          </span>
        </div>

        {/* Pending count (if any) */}
        {current.pendingCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {current.pendingCount} proposal{current.pendingCount !== 1 ? 's' : ''} pending
          </p>
        )}

        {/* Expandable narrative */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? (
            <>
              Less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              More <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>

        {expanded && (
          <p className="text-xs leading-relaxed text-muted-foreground border-t border-border pt-2">
            {narrative}
          </p>
        )}
      </div>
    </HubCard>
  );
}
