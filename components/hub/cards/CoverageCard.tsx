'use client';

import { Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { HubCard, HubCardSkeleton, HubCardError, type CardUrgency } from './HubCard';

interface CoverageData {
  coveredTypes: number;
  totalTypes: number;
  coveragePct: number;
  hasDrep: boolean;
  hasPool: boolean;
  poolIsGovActive: boolean;
  drepIsActive: boolean;
  gaps: string[];
  alerts: Array<{ type: string; message: string }>;
}

/**
 * CoverageCard — One-liner governance coverage summary for the Hub.
 *
 * JTBD: "How complete is my governance representation?"
 * Shows coverage percentage with color-coded bar + one-line gap summary.
 * Links to /delegation for the full breakdown.
 */
export function CoverageCard() {
  const { stakeAddress } = useSegment();

  const { data, isLoading, isError, refetch } = useQuery<CoverageData>({
    queryKey: ['governance-coverage', stakeAddress],
    queryFn: async () => {
      const res = await fetch(
        `/api/governance/coverage?stakeAddress=${encodeURIComponent(stakeAddress!)}`,
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!stakeAddress,
    staleTime: 2 * 60 * 1000,
  });

  // Only render for authenticated users
  if (!stakeAddress) return null;

  if (isLoading) return <HubCardSkeleton />;
  if (isError) return <HubCardError message="Couldn't load coverage" onRetry={() => refetch()} />;
  if (!data) return null;

  const { coveragePct, gaps } = data;

  // Determine urgency and verdict
  let verdict: string;
  let urgency: CardUrgency;
  if (coveragePct === 100) {
    verdict = 'Full coverage';
    urgency = 'success';
  } else if (coveragePct >= 50) {
    verdict = 'Partial coverage';
    urgency = 'warning';
  } else {
    verdict = 'Low coverage';
    urgency = 'critical';
  }

  const bandColor =
    urgency === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : urgency === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  const barColor =
    urgency === 'success'
      ? 'bg-emerald-500'
      : urgency === 'warning'
        ? 'bg-amber-500'
        : 'bg-red-500';

  // Build one-line gap summary
  const gapSummary = gaps.length > 0 ? `Missing: ${gaps.join(', ').toLowerCase()}` : null;

  return (
    <HubCard
      href="/delegation"
      urgency={urgency === 'success' ? 'default' : urgency}
      label={`Governance coverage: ${verdict}, ${coveragePct}%`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Governance Coverage
              </span>
            </div>
            <p className="text-base font-semibold text-foreground">
              <span className={bandColor}>{verdict}</span>
            </p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold tabular-nums ${bandColor}`}>{coveragePct}</span>
            <p className="text-xs text-muted-foreground">%</p>
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${coveragePct}%` }}
          />
        </div>

        {/* One-line gap summary */}
        {gapSummary && <p className="text-xs text-muted-foreground truncate">{gapSummary}</p>}
      </div>
    </HubCard>
  );
}
