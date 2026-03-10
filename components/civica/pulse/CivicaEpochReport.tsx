'use client';

import Link from 'next/link';
import { Vote, Users, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { cn } from '@/lib/utils';
import { useGovernancePulse } from '@/hooks/queries';

const SHELLEY_START_UNIX = 1596059091;
const SHELLEY_EPOCH = 208;
const EPOCH_SECONDS = 432000;

function epochProgress(epoch: number): {
  pct: number;
  hoursRemaining: number;
  daysRemaining: number;
} {
  const epochStart = SHELLEY_START_UNIX + (epoch - SHELLEY_EPOCH) * EPOCH_SECONDS;
  const epochEnd = epochStart + EPOCH_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const pct = Math.min(100, Math.max(0, ((now - epochStart) / EPOCH_SECONDS) * 100));
  const secondsRemaining = Math.max(0, epochEnd - now);
  return {
    pct: Math.round(pct * 10) / 10,
    hoursRemaining: Math.round(secondsRemaining / 3600),
    daysRemaining: Math.round((secondsRemaining / 86400) * 10) / 10,
  };
}

function ProgressBar({ pct, color = 'bg-primary' }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PipelineStep({
  label,
  count,
  color,
  icon: Icon,
  href,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.FC<{ className?: string }>;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        'flex-1 rounded-xl border p-3 space-y-1.5 text-center',
        href && 'hover:border-primary/30 transition-colors cursor-pointer',
      )}
    >
      <Icon className={cn('h-4 w-4 mx-auto', color)} />
      <p className={cn('font-display text-2xl font-bold tabular-nums', color)}>{count}</p>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function CivicaEpochReport() {
  const { data: rawPulse, isLoading, isError, refetch } = useGovernancePulse();
  const pulse = rawPulse as
    | {
        currentEpoch?: number;
        avgParticipationRate?: number;
        avgRationaleRate?: number;
        activeProposals?: number;
        criticalProposals?: number;
        activeDReps?: number;
        totalDReps?: number;
        votesThisWeek?: number;
        spotlightProposal?: {
          txHash: string;
          index: number;
          title: string;
          proposalType?: string;
          voteCoverage?: number;
        };
      }
    | undefined;

  const currentEpoch: number | undefined = pulse?.currentEpoch;
  const progress = currentEpoch ? epochProgress(currentEpoch) : null;

  const participationPct: number = pulse?.avgParticipationRate ?? 0;
  const rationalePct: number = pulse?.avgRationaleRate ?? 0;
  const activeProposals: number = pulse?.activeProposals ?? 0;
  const criticalProposals: number = pulse?.criticalProposals ?? 0;
  const activeDReps: number = pulse?.activeDReps ?? 0;
  const totalDReps: number = pulse?.totalDReps ?? 0;
  const votesThisWeek: number = pulse?.votesThisWeek ?? 0;

  if (isError) {
    return <ErrorCard message="Unable to load epoch report." onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {/* Epoch progress */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Current Epoch
            </p>
            <p className="font-display text-4xl font-bold mt-0.5">
              {isLoading ? (
                <Skeleton className="h-9 w-20 inline-block" />
              ) : (
                (currentEpoch ?? '\u2014')
              )}
            </p>
          </div>
          {progress && (
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-primary tabular-nums">
                {progress.pct}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {progress.daysRemaining}d remaining
              </p>
            </div>
          )}
        </div>
        {progress ? (
          <div className="space-y-1.5">
            <ProgressBar pct={progress.pct} color="bg-primary" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Epoch start</span>
              <span>{progress.hoursRemaining}h until next epoch</span>
            </div>
          </div>
        ) : (
          <Skeleton className="h-2 w-full" />
        )}
      </div>

      {/* Proposal pipeline */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Proposal Pipeline
        </p>
        {isLoading ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 rounded-xl border border-border bg-card p-3">
                <Skeleton className="h-4 w-4 mx-auto mb-2" />
                <Skeleton className="h-6 w-8 mx-auto mb-1" />
                <Skeleton className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <PipelineStep
              label="Active"
              count={activeProposals}
              color={criticalProposals > 0 ? 'text-amber-400' : 'text-primary'}
              icon={Vote}
              href="/governance/proposals"
            />
            <PipelineStep
              label="Critical"
              count={criticalProposals}
              color={criticalProposals > 0 ? 'text-rose-400' : 'text-muted-foreground'}
              icon={AlertCircle}
              href={criticalProposals > 0 ? '/governance/proposals' : undefined}
            />
            <PipelineStep
              label="Votes/week"
              count={votesThisWeek}
              color="text-emerald-400"
              icon={CheckCircle2}
            />
          </div>
        )}
      </div>

      {/* DRep participation */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">DRep Participation</p>
          {!isLoading && (
            <span className="ml-auto text-xs text-muted-foreground">
              {activeDReps} / {totalDReps} active
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg participation rate</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    participationPct >= 70
                      ? 'text-emerald-400'
                      : participationPct >= 40
                        ? 'text-amber-400'
                        : 'text-rose-400',
                  )}
                >
                  {participationPct}%
                </span>
              </div>
              <ProgressBar
                pct={participationPct}
                color={
                  participationPct >= 70
                    ? 'bg-emerald-500'
                    : participationPct >= 40
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg rationale rate</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    rationalePct >= 60
                      ? 'text-emerald-400'
                      : rationalePct >= 30
                        ? 'text-amber-400'
                        : 'text-rose-400',
                  )}
                >
                  {rationalePct}%
                </span>
              </div>
              <ProgressBar
                pct={rationalePct}
                color={
                  rationalePct >= 60
                    ? 'bg-emerald-500'
                    : rationalePct >= 30
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Active DReps</span>
                <span className="font-semibold tabular-nums text-primary">
                  {totalDReps > 0 ? Math.round((activeDReps / totalDReps) * 100) : 0}%
                </span>
              </div>
              <ProgressBar
                pct={totalDReps > 0 ? (activeDReps / totalDReps) * 100 : 0}
                color="bg-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Spotlight proposal */}
      {pulse?.spotlightProposal && (
        <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Spotlight — Most Active Proposal
            </p>
          </div>
          <Link
            href={`/proposal/${pulse.spotlightProposal.txHash}/${pulse.spotlightProposal.index}`}
            className="block text-sm font-medium hover:text-primary transition-colors"
          >
            {pulse.spotlightProposal.title}
          </Link>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="capitalize">
              {pulse.spotlightProposal.proposalType?.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            {pulse.spotlightProposal.voteCoverage != null && (
              <span>
                <strong className="text-foreground">{pulse.spotlightProposal.voteCoverage}%</strong>{' '}
                DRep coverage
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
