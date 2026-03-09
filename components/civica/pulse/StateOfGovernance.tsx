'use client';

import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import {
  useGovernanceHealthIndex,
  useGovernancePulse,
  useTreasuryCurrent,
  useGovernanceSummary,
} from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';

interface GHIState {
  score?: number;
  band?: string;
  trend?: { direction?: string; delta?: number };
  current?: { score?: number; band?: string };
  [key: string]: unknown;
}

interface PulseState {
  activeProposals?: number;
  votesThisWeek?: number;
  avgParticipationRate?: number;
  [key: string]: unknown;
}

interface TreasuryState {
  balance?: number;
  trend?: string;
  [key: string]: unknown;
}

interface SummaryState {
  name?: string;
  givenName?: string;
  participationRate?: number;
  drepScore?: number;
  score?: number;
  [key: string]: unknown;
}

function buildNarrative(
  ghi: GHIState | undefined,
  pulse: PulseState | undefined,
  treasury: TreasuryState | undefined,
): string {
  const parts: string[] = [];

  const score = ghi?.score ?? ghi?.current?.score;
  const band = ghi?.band ?? ghi?.current?.band;
  const trend = ghi?.trend;

  if (score != null) {
    const direction =
      trend?.direction === 'up'
        ? `up ${Math.abs(trend.delta ?? 0)} points`
        : trend?.direction === 'down'
          ? `down ${Math.abs(trend.delta ?? 0)} points`
          : 'stable';
    const bandLabel = band ? ` (${band})` : '';
    parts.push(`Governance health is at ${score}${bandLabel}, ${direction} this epoch`);
  }

  const activeProposals = pulse?.activeProposals;
  const votesThisWeek = pulse?.votesThisWeek;
  const avgParticipation = pulse?.avgParticipationRate;

  if (activeProposals != null && votesThisWeek != null) {
    parts.push(
      `with ${activeProposals} active proposal${activeProposals !== 1 ? 's' : ''} and ${votesThisWeek.toLocaleString()} votes cast this week`,
    );
  } else if (avgParticipation != null) {
    parts.push(`with ${avgParticipation}% average DRep participation`);
  }

  if (treasury?.balance != null) {
    const balanceStr =
      treasury.balance >= 1_000_000_000
        ? `${(treasury.balance / 1_000_000_000).toFixed(1)}B`
        : treasury.balance >= 1_000_000
          ? `${(treasury.balance / 1_000_000).toFixed(0)}M`
          : `${Math.round(treasury.balance / 1_000)}K`;
    const trendLabel =
      treasury.trend === 'growing'
        ? 'growing'
        : treasury.trend === 'shrinking'
          ? 'under pressure'
          : 'stable';
    parts.push(`Treasury holds ₳${balanceStr} and is ${trendLabel}`);
  }

  if (parts.length === 0) return '';

  let narrative = parts[0];
  if (parts.length === 2) narrative += `, ${parts[1]}.`;
  else if (parts.length >= 3) narrative += `, ${parts[1]}. ${parts[2]}.`;
  else narrative += '.';

  return narrative.charAt(0).toUpperCase() + narrative.slice(1);
}

function buildPersonalAddendum(
  _pulse: PulseState | undefined,
  summary: SummaryState | undefined,
  segment: string,
): string | null {
  if (segment === 'anonymous') return null;

  const drepName = summary?.name ?? summary?.givenName;
  const votedAll = (summary?.participationRate ?? 0) >= 90;

  if (segment === 'citizen' || segment === 'delegated') {
    if (drepName && votedAll) {
      return `Your DRep ${drepName} voted on all proposals this epoch.`;
    }
    if (drepName) {
      return `Your DRep ${drepName} is actively participating in governance.`;
    }
  }

  if (segment === 'drep') {
    const score = summary?.drepScore ?? summary?.score;
    if (score != null) {
      return `Your governance score is ${score.toFixed(1)}.`;
    }
  }

  return null;
}

export function StateOfGovernance() {
  const {
    data: rawGHI,
    isLoading: ghiLoading,
    isError: ghiError,
    refetch: refetchGhi,
  } = useGovernanceHealthIndex(1);
  const {
    data: rawPulse,
    isLoading: pulseLoading,
    isError: pulseError,
    refetch: refetchPulse,
  } = useGovernancePulse();
  const { data: rawTreasury } = useTreasuryCurrent();

  const { segment, delegatedDrep, drepId } = useSegment();
  const lookupId = segment === 'drep' ? drepId : delegatedDrep;
  const { data: rawSummary } = useGovernanceSummary(lookupId);

  const ghi = rawGHI as GHIState | undefined;
  const pulse = rawPulse as PulseState | undefined;
  const treasury = rawTreasury as TreasuryState | undefined;
  const summary = rawSummary as SummaryState | undefined;

  const narrative = buildNarrative(ghi, pulse, treasury);
  const personal = buildPersonalAddendum(pulse, summary, segment);
  const loading = ghiLoading || pulseLoading;
  const hasError = ghiError || pulseError;

  if (hasError) {
    return (
      <ErrorCard
        message="Unable to load governance state."
        onRetry={() => {
          refetchGhi();
          refetchPulse();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!narrative) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <p className="text-[11px] text-primary font-semibold uppercase tracking-wider">
          State of Governance
        </p>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{narrative}</p>
      {personal && <p className="text-xs text-primary/80 italic">{personal}</p>}
    </div>
  );
}
