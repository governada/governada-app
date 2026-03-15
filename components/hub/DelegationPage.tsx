'use client';

import Link from 'next/link';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Server,
  Info,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceHolder, useSPOSummary, useAlignmentDrift } from '@/hooks/queries';
import { FeatureGate } from '@/components/FeatureGate';
import { DRepTreasuryStewardship } from '@/components/delegation/DRepTreasuryStewardship';
import { DelegationStory } from './DelegationStory';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { computeTier } from '@/lib/scoring/tiers';
import {
  getScoreNarrative,
  getParticipationNarrative,
  getRationaleNarrative,
} from '@/lib/scoring/scoreNarratives';

function TrendArrow({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

const DIMENSION_LABELS: Record<string, string> = {
  treasury_conservative: 'Treasury (conservative)',
  treasury_growth: 'Treasury (growth)',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

function DRepSection() {
  const { stakeAddress, delegatedDrep } = useSegment();
  const { data: holderRaw, isLoading } = useGovernanceHolder(stakeAddress);
  const { data: driftData } = useAlignmentDrift(delegatedDrep ? stakeAddress : null);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Not delegated
  if (!delegatedDrep) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">No DRep Delegation</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your ADA is not represented in governance decisions. Delegate to a DRep to make your voice
          count.
        </p>
        <div className="flex gap-3">
          <Button asChild size="sm">
            <Link href="/match">
              Find a DRep <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/governance/representatives">Browse DReps</Link>
          </Button>
        </div>
      </div>
    );
  }

  const holder = holderRaw as Record<string, unknown> | undefined;
  const drep = holder?.drep as Record<string, unknown> | undefined;
  const drepName = (drep?.name as string) || (drep?.ticker as string) || 'Your DRep';
  const drepScore = Math.round((drep?.score as number) ?? 0);
  const isActive = (drep?.isActive as boolean) ?? true;
  const participationRate = Math.round((drep?.participationRate as number) ?? 0);
  const rationaleRate = Math.round((drep?.rationaleRate as number) ?? 0);
  const recentVotes = (drep?.recentVotes as number) ?? 0;
  const scoreChange = (drep?.scoreChange as number) ?? 0;

  const StatusIcon = isActive ? ShieldCheck : ShieldX;
  const statusColor = isActive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* DRep header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your DRep
            </span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{drepName}</h2>
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            <span className={statusColor}>{isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tabular-nums text-foreground">{drepScore}</span>
          <p className="text-xs font-medium text-muted-foreground">{computeTier(drepScore)}</p>
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <TrendArrow value={scoreChange} />
            <span className="tabular-nums">
              {scoreChange >= 0 ? '+' : ''}
              {scoreChange.toFixed(1)}
            </span>
            {scoreChange > 0 && (
              <span className="text-muted-foreground/70">&middot; improving</span>
            )}
            {scoreChange < 0 && (
              <span className="text-muted-foreground/70">&middot; declining</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {getScoreNarrative({ score: drepScore, percentile: 50 })}
          </p>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{participationRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
            {getParticipationNarrative(participationRate)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{rationaleRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Rationale Rate</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">
            {getRationaleNarrative(rationaleRate)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{recentVotes}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Recent Votes</p>
        </div>
      </div>

      {/* Alignment drift indicator */}
      <FeatureGate flag="alignment_drift">
        {driftData?.drift && driftData.drift.classification !== 'low' && (
          <div
            className={`rounded-xl p-3 space-y-2 ${
              driftData.drift.classification === 'high'
                ? 'border border-red-500/30 bg-red-500/5'
                : 'border border-amber-500/30 bg-amber-500/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`h-4 w-4 ${
                    driftData.drift.classification === 'high' ? 'text-red-500' : 'text-amber-500'
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    driftData.drift.classification === 'high'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {driftData.drift.classification === 'high'
                    ? 'Values misaligned'
                    : 'Values drifting'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                Drift: {driftData.drift.score}
              </span>
            </div>
            {driftData.drift.worstDimension && (
              <p className="text-xs text-muted-foreground">
                Biggest gap:{' '}
                {DIMENSION_LABELS[driftData.drift.worstDimension] ?? driftData.drift.worstDimension}
              </p>
            )}
            {driftData.drift.classification === 'high' && (
              <Link
                href="/match"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Find a better match <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </FeatureGate>

      {/* Treasury stewardship */}
      <DRepTreasuryStewardship drepId={delegatedDrep} />

      {/* Link to full profile */}
      <Link
        href={`/drep/${encodeURIComponent(delegatedDrep)}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View full profile <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function PoolSection() {
  const { delegatedPool } = useSegment();
  const { data: poolRaw, isLoading } = useSPOSummary(delegatedPool);

  if (!delegatedPool) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Stake Pool
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          No stake pool detected. Your ADA may be staked to a pool without governance participation.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const pool = poolRaw as Record<string, unknown> | undefined;
  const poolName = (pool?.poolName as string) || (pool?.ticker as string) || 'Your Pool';
  const ticker = (pool?.ticker as string) ?? '';
  const govScore = Math.round((pool?.governanceScore as number) ?? 0);
  const voteCount = (pool?.voteCount as number) ?? 0;
  const participationRate = Math.round((pool?.participationRate as number) ?? 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stake Pool
            </span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {ticker ? `[${ticker}] ` : ''}
            {poolName}
          </h2>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums text-foreground">{govScore}</span>
          <p className="text-xs text-muted-foreground">Gov Score</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{voteCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Votes Cast</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{participationRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
        </div>
      </div>

      <Link
        href={`/pool/${encodeURIComponent(delegatedPool)}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View pool profile <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ─── Coverage action type definitions ─────────────────── */

interface ActionType {
  id: string;
  label: string;
  coveredBy: 'drep' | 'pool';
}

const ACTION_TYPES: ActionType[] = [
  { id: 'TreasuryWithdrawals', label: 'Treasury withdrawals', coveredBy: 'drep' },
  { id: 'ParameterChange', label: 'Parameter changes', coveredBy: 'pool' },
  { id: 'HardForkInitiation', label: 'Hard fork initiation', coveredBy: 'pool' },
  { id: 'NoConfidence', label: 'No confidence', coveredBy: 'drep' },
  { id: 'NewConstitution', label: 'New constitution', coveredBy: 'drep' },
  { id: 'NewCommittee', label: 'Committee updates', coveredBy: 'drep' },
  { id: 'InfoAction', label: 'Info actions', coveredBy: 'drep' },
];

/**
 * CoverageSummary — Hero element showing governance coverage as the dominant visual.
 *
 * Governance coverage = having active representation across governance action types.
 * DReps vote on most governance actions. SPOs vote on protocol parameters and hard forks.
 * Full coverage means both a DRep AND a governance-active pool are delegated.
 */
function CoverageSummary({
  hasDrep,
  hasPool,
  poolIsGovActive,
}: {
  hasDrep: boolean;
  hasPool: boolean;
  poolIsGovActive: boolean;
}) {
  const totalTypes = 7;

  // Determine which action types are covered
  const coveredActions = ACTION_TYPES.map((action) => {
    if (action.coveredBy === 'drep') {
      return { ...action, covered: hasDrep, source: hasDrep ? 'DRep' : null };
    }
    return {
      ...action,
      covered: hasPool && poolIsGovActive,
      source: hasPool && poolIsGovActive ? 'Pool' : null,
    };
  });

  const covered = coveredActions.filter((a) => a.covered).length;
  const pct = Math.round((covered / totalTypes) * 100);

  let verdict: string;
  let verdictColor: string;
  let ringColor: string;
  let borderAccent: string;
  if (pct === 100) {
    verdict = 'Full coverage';
    verdictColor = 'text-emerald-600 dark:text-emerald-400';
    ringColor = 'stroke-emerald-500';
    borderAccent = 'border-emerald-500/30';
  } else if (pct >= 50) {
    verdict = 'Partial coverage';
    verdictColor = 'text-amber-600 dark:text-amber-400';
    ringColor = 'stroke-amber-500';
    borderAccent = 'border-amber-500/30';
  } else {
    verdict = 'Low coverage';
    verdictColor = 'text-red-600 dark:text-red-400';
    ringColor = 'stroke-red-500';
    borderAccent = 'border-red-500/30';
  }

  // Build narrative explanation
  const drepActions = coveredActions.filter((a) => a.coveredBy === 'drep' && a.covered);
  const poolActions = coveredActions.filter((a) => a.coveredBy === 'pool' && a.covered);
  const uncoveredActions = coveredActions.filter((a) => !a.covered);

  let narrative: string;
  if (covered === totalTypes) {
    narrative =
      'Your DRep covers treasury, constitutional, and committee votes. Your pool covers protocol parameters and hard forks. You have full governance representation.';
  } else {
    const parts: string[] = [];
    if (drepActions.length > 0) {
      parts.push(`Your DRep covers ${drepActions.map((a) => a.label.toLowerCase()).join(', ')}`);
    }
    if (poolActions.length > 0) {
      parts.push(`Your pool covers ${poolActions.map((a) => a.label.toLowerCase()).join(', ')}`);
    }
    if (!hasPool) {
      parts.push(
        "You don't have a governance-active pool — this leaves hard fork and parameter votes uncovered",
      );
    } else if (!poolIsGovActive) {
      parts.push(
        "Your pool hasn't voted on governance — protocol parameter and hard fork votes are uncovered",
      );
    }
    if (!hasDrep) {
      parts.push(
        'Without a DRep, you have no representation on treasury, constitutional, or committee votes',
      );
    }
    narrative = parts.join('. ') + '.';
  }

  // SVG ring dimensions
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className={cn('rounded-2xl border-2 bg-card p-6 space-y-5', borderAccent)}>
      {/* Hero: ring + verdict */}
      <div className="flex items-center gap-6">
        {/* Progress ring */}
        <div className="relative shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="rotate-[-90deg]">
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              strokeWidth="8"
              className="stroke-muted"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={cn('transition-all duration-700', ringColor)}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-2xl font-bold tabular-nums', verdictColor)}>
              {covered}/{totalTypes}
            </span>
          </div>
        </div>

        {/* Verdict text */}
        <div className="space-y-1 min-w-0">
          <h2 className={cn('text-xl font-bold', verdictColor)}>{verdict}</h2>
          <p className="text-sm text-muted-foreground">
            Your governance coverage: {covered} of {totalTypes} action types
          </p>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>

      {/* Action type checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {coveredActions.map((action) => (
          <div key={action.id} className="flex items-center gap-2 text-sm">
            {action.covered ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
            <span className={cn(action.covered ? 'text-foreground' : 'text-muted-foreground/60')}>
              {action.label}
            </span>
            {action.source && (
              <span className="text-xs text-muted-foreground/50">({action.source})</span>
            )}
          </div>
        ))}
      </div>

      {/* Uncovered types warning */}
      {uncoveredActions.length > 0 && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 space-y-1">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Missing coverage</p>
          <p className="text-xs text-muted-foreground">
            {uncoveredActions.map((a) => a.label).join(', ')} — these action types have no
            representation for your ADA.
          </p>
        </div>
      )}

      {/* Explainer */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Cardano governance has 7 action types. DReps vote on 5 (treasury, constitution, committee,
          info actions, no-confidence). Stake pools vote on 2 (protocol parameters, hard forks).
          Full coverage means both representatives are active.
        </span>
      </div>
    </div>
  );
}

/**
 * DelegationPage — Governance coverage showing both representatives.
 *
 * JTBD: "Who represents my ADA in governance?"
 * Shows coverage summary + DRep + Pool.
 * The page a citizen lands on from the RepresentationCard.
 */
export function DelegationPage() {
  const { segment, delegatedDrep, delegatedPool } = useSegment();
  const { data: poolRaw } = useSPOSummary(delegatedPool);

  // Redirect anonymous users to discover
  if (segment === 'anonymous') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Connect Your Wallet</h1>
        <p className="text-muted-foreground">
          Connect your wallet to see who represents your ADA in governance.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/match">Find a DRep</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/governance">Browse Governance</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pool = poolRaw as Record<string, unknown> | undefined;
  const poolIsGovActive = ((pool?.voteCount as number) ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Your Governance Coverage</h1>
        <p className="text-sm text-muted-foreground">
          How well your ADA is represented across all governance action types.
        </p>
      </div>

      <CoverageSummary
        hasDrep={!!delegatedDrep}
        hasPool={!!delegatedPool}
        poolIsGovActive={poolIsGovActive}
      />

      <DRepSection />
      <PoolSection />

      {/* Your Story — longitudinal delegation narrative */}
      {!!delegatedDrep && <DelegationStory />}
    </div>
  );
}
