'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAda } from '@/lib/treasury';
import { Skeleton } from '@/components/ui/skeleton';
import { useGovernancePulse, useTreasuryCurrent, useGovernanceHealthIndex } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PulseData {
  activeProposals?: number;
  criticalProposals?: number;
  currentEpoch?: number;
  activeDReps?: number;
  totalDReps?: number;
  votesThisWeek?: number;
  avgParticipationRate?: number;
  avgRationaleRate?: number;
  totalAdaGoverned?: string;
  deltas?: {
    participationDelta?: number | null;
    rationaleDelta?: number | null;
    activeDRepsDelta?: number | null;
  };
}

interface TreasuryData {
  balance?: number;
  balanceAda?: number;
  trend?: string;
  runwayMonths?: number;
  pendingCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Band = 'healthy' | 'moderate' | 'concerning';

function participationBand(rate: number): Band {
  if (rate >= 70) return 'healthy';
  if (rate >= 40) return 'moderate';
  return 'concerning';
}

function rationaleBand(rate: number): Band {
  if (rate >= 60) return 'healthy';
  if (rate >= 30) return 'moderate';
  return 'concerning';
}

function runwayBand(months: number): Band {
  if (months > 24) return 'healthy';
  if (months > 12) return 'moderate';
  return 'concerning';
}

function bandColor(band: Band): string {
  switch (band) {
    case 'healthy':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'moderate':
      return 'text-amber-600 dark:text-amber-400';
    case 'concerning':
      return 'text-rose-600 dark:text-rose-400';
  }
}

function bandLabel(band: Band): string {
  switch (band) {
    case 'healthy':
      return 'healthy';
    case 'moderate':
      return 'moderate';
    case 'concerning':
      return 'concerning';
  }
}

function formatDelta(value: number | null | undefined): string {
  if (value == null) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}

function DeltaArrow({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0)
    return <Minus className="inline h-3 w-3 text-muted-foreground" />;
  if (value > 0) return <TrendingUp className="inline h-3 w-3 text-emerald-500" />;
  return <TrendingDown className="inline h-3 w-3 text-rose-500" />;
}

function TrendArrow({ trend }: { trend: string | undefined }) {
  if (!trend || trend === 'stable')
    return <Minus className="inline h-3 w-3 text-muted-foreground" />;
  if (trend === 'up') return <TrendingUp className="inline h-3 w-3 text-emerald-500" />;
  return <TrendingDown className="inline h-3 w-3 text-rose-500" />;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function BriefingSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      {/* Narrative lines */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[85%]" />
      </div>
      {/* Headline pills */}
      <div className="flex gap-3">
        <Skeleton className="h-14 flex-1 rounded-lg" />
        <Skeleton className="h-14 flex-1 rounded-lg" />
        <Skeleton className="h-14 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GovernanceBriefing() {
  const segment = useSegment();
  const { data: pulseRaw, isLoading: pulseLoading, isError: pulseError } = useGovernancePulse();
  const {
    data: treasuryRaw,
    isLoading: treasuryLoading,
    isError: treasuryError,
  } = useTreasuryCurrent();
  const { isLoading: ghiLoading, isError: ghiError } = useGovernanceHealthIndex();

  const isLoading = pulseLoading || treasuryLoading || ghiLoading;
  const isError = pulseError || treasuryError || ghiError;

  if (isLoading) return <BriefingSkeleton />;
  if (isError) return null;

  const pulse = (pulseRaw ?? {}) as PulseData;
  const treasury = (treasuryRaw ?? {}) as TreasuryData;

  const activeDReps = pulse.activeDReps ?? 0;
  const drepDelta = pulse.deltas?.activeDRepsDelta;
  const votesThisWeek = pulse.votesThisWeek ?? 0;
  const activeProposals = pulse.activeProposals ?? 0;
  const criticalProposals = pulse.criticalProposals ?? 0;
  const avgParticipation = pulse.avgParticipationRate ?? 0;
  const avgRationale = pulse.avgRationaleRate ?? 0;
  const participationDelta = pulse.deltas?.participationDelta;

  const treasuryBalance = treasury.balanceAda ?? treasury.balance ?? 0;
  const runway = treasury.runwayMonths ?? 0;
  const treasuryTrend = treasury.trend;

  const pBand = participationBand(avgParticipation);
  const rBand = rationaleBand(avgRationale);
  const tBand = runwayBand(runway);

  const criticalMention =
    criticalProposals > 0 ? `, including ${criticalProposals} marked critical` : '';

  const runwayLabel =
    runway >= 12 ? `${Math.round(runway / 12)}+ years` : `${Math.round(runway)} months`;

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      {/* Narrative paragraph */}
      <p className="text-sm text-foreground leading-relaxed">
        <Link
          href="/governance/representatives"
          className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          <strong className={bandColor(pBand)}>{activeDReps.toLocaleString()}</strong> DReps
        </Link>{' '}
        are actively participating this epoch
        {drepDelta != null ? (
          <>
            {' '}
            &mdash;{' '}
            <strong
              className={cn(
                drepDelta > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : drepDelta < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-muted-foreground',
              )}
            >
              {formatDelta(drepDelta)}
            </strong>{' '}
            from last.
          </>
        ) : (
          '.'
        )}{' '}
        They&rsquo;ve cast{' '}
        <strong className={bandColor(pBand)}>{votesThisWeek.toLocaleString()}</strong> votes across{' '}
        <Link
          href="/governance/proposals"
          className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          <strong className={bandColor(pBand)}>{activeProposals.toLocaleString()}</strong> active
          proposals
        </Link>
        {criticalMention ? (
          <>
            , including{' '}
            <strong className="text-rose-600 dark:text-rose-400">{criticalProposals}</strong> marked
            critical
          </>
        ) : (
          ''
        )}
        . Participation rate is{' '}
        <strong className={bandColor(pBand)}>{avgParticipation.toFixed(1)}%</strong> (
        {bandLabel(pBand)}), while{' '}
        <strong className={bandColor(rBand)}>{avgRationale.toFixed(1)}%</strong> are providing
        rationales. The treasury holds{' '}
        <strong className={bandColor(tBand)}>&#8371;{formatAda(treasuryBalance)}</strong> with{' '}
        <strong className={bandColor(tBand)}>{runwayLabel}</strong> runway.
      </p>

      {/* Headline metrics row */}
      <div className="flex flex-wrap gap-3">
        {/* Participation Rate */}
        <div className="flex-1 min-w-[120px] rounded-lg bg-muted/30 px-3 py-2">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Participation
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn('text-sm font-semibold', bandColor(pBand))}>
              {avgParticipation.toFixed(1)}%
            </span>
            <DeltaArrow value={participationDelta} />
            {participationDelta != null && participationDelta !== 0 && (
              <span className="text-[11px] text-muted-foreground">
                {formatDelta(participationDelta)}pp
              </span>
            )}
          </div>
        </div>

        {/* Active Proposals */}
        <div className="flex-1 min-w-[120px] rounded-lg bg-muted/30 px-3 py-2">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Active Proposals
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-semibold text-foreground">{activeProposals}</span>
            {criticalProposals > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" />
                {criticalProposals} critical
              </span>
            )}
          </div>
        </div>

        {/* Treasury Balance */}
        <div className="flex-1 min-w-[120px] rounded-lg bg-muted/30 px-3 py-2">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Treasury
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn('text-sm font-semibold', bandColor(tBand))}>
              &#8371;{formatAda(treasuryBalance)}
            </span>
            <TrendArrow trend={treasuryTrend} />
          </div>
        </div>
      </div>
    </div>
  );
}
