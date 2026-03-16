'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAda } from '@/lib/treasury';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import {
  useGovernancePulse,
  useGovernanceEpochRecap,
  useGovernanceCalendar,
  useGovernanceSparklines,
} from '@/hooks/queries';

interface CalendarData {
  currentEpoch: number;
  secondsRemaining: number;
  epochProgress: number;
  upcoming: {
    txHash: string;
    index: number;
    title: string;
    proposalType: string;
    epochsLeft: number | null;
    daysLeft: number | null;
  }[];
}

function formatCountdown(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function EpochProgressHero({
  calendar,
  countdown,
}: {
  calendar: CalendarData;
  countdown: number | null;
}) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[11px] text-primary uppercase tracking-wider font-semibold">
            Current Epoch
          </p>
          <p className="font-display text-3xl font-bold tabular-nums text-foreground">
            {calendar.currentEpoch}
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-1.5 justify-end">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium tabular-nums">
              {countdown !== null ? formatCountdown(countdown) : '—'} remaining
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {calendar.epochProgress}% complete
          </p>
        </div>
      </div>
      <div className="h-3 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${calendar.epochProgress}%` }}
        />
      </div>
    </div>
  );
}

function ProposalDeadline({ proposal }: { proposal: CalendarData['upcoming'][0] }) {
  const urgent = proposal.epochsLeft !== null && proposal.epochsLeft <= 1;
  const warning = proposal.epochsLeft !== null && proposal.epochsLeft <= 2;

  return (
    <Link
      href={`/proposal/${proposal.txHash}/${proposal.index}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      {urgent && <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{proposal.title}</p>
        <p className="text-[11px] text-muted-foreground capitalize">
          {proposal.proposalType?.replace(/([A-Z])/g, ' $1').trim()}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {proposal.daysLeft !== null && (
          <span
            className={cn(
              'text-xs font-medium tabular-nums px-2 py-0.5 rounded-full border',
              urgent
                ? 'text-rose-400 border-rose-900/40 bg-rose-950/20'
                : warning
                  ? 'text-amber-400 border-amber-900/40 bg-amber-950/20'
                  : 'text-muted-foreground border-border',
            )}
          >
            ~{proposal.daysLeft}d
          </span>
        )}
      </div>
    </Link>
  );
}

function EpochRecapCard({ recap }: { recap: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const ratified = (recap.proposalsRatified ?? recap.proposals_ratified ?? 0) as number;
  const submitted = (recap.proposalsSubmitted ?? recap.proposals_submitted) as number | undefined;
  const dropped = (recap.proposalsDropped ?? recap.proposals_dropped) as number | undefined;
  const expired = (recap.proposalsExpired ?? recap.proposals_expired) as number | undefined;
  const adaWithdrawn = (recap.adaWithdrawn ??
    recap.treasury_withdrawn_ada ??
    recap.treasuryWithdrawnAda) as number | undefined;
  const participation = (recap.drepParticipationPct ?? recap.drep_participation_pct) as
    | number
    | undefined;
  const narrative = (recap.summary ?? recap.ai_narrative ?? recap.aiNarrative) as
    | string
    | undefined;

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tabular-nums text-muted-foreground">
            {recap.epoch as React.ReactNode}
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{ratified} ratified</span>
              {submitted != null && submitted > 0 && (
                <span className="text-[11px] text-muted-foreground">{submitted} submitted</span>
              )}
              {adaWithdrawn ? (
                <span className="text-[11px] text-emerald-400">₳{formatAda(adaWithdrawn)}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {participation != null && (
                <span className="text-[11px] text-muted-foreground">
                  {Math.round(participation)}% participation
                </span>
              )}
              {dropped != null && dropped > 0 && (
                <span className="text-[11px] text-rose-400/70">{dropped} dropped</span>
              )}
              {expired != null && expired > 0 && (
                <span className="text-[11px] text-amber-400/70">{expired} expired</span>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && narrative && (
        <div className="px-4 pb-3 text-xs text-muted-foreground border-t border-border pt-2 leading-relaxed">
          {narrative}
        </div>
      )}
    </div>
  );
}

export function GovernadaGovernanceCalendar() {
  const {
    data: rawCalendar,
    isLoading: calendarLoading,
    isError: calendarError,
    refetch: refetchCalendar,
  } = useGovernanceCalendar();
  const calendar = (rawCalendar as CalendarData) ?? null;

  const { data: rawPulse } = useGovernancePulse();
  const { data: rawRecap } = useGovernanceEpochRecap();
  const { data: rawSparklines } = useGovernanceSparklines();
  const pulse = rawPulse as Record<string, unknown> | undefined;
  const recap = rawRecap as Record<string, unknown> | undefined;
  const sparklines = rawSparklines as Record<string, unknown> | undefined;
  const participationRows: { epoch: number; participation_rate: number; rationale_rate: number }[] =
    (sparklines?.participation as {
      epoch: number;
      participation_rate: number;
      rationale_rate: number;
    }[]) ?? [];

  // Initialize countdown from server data, then tick locally
  const initialSeconds = calendar?.secondsRemaining ?? null;
  const lastInitRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (initialSeconds !== null && initialSeconds !== lastInitRef.current) {
      lastInitRef.current = initialSeconds;
      setCountdown(initialSeconds);
    }
  }, [initialSeconds]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const epochRecaps: Record<string, unknown>[] = Array.isArray(recap?.recaps)
    ? recap.recaps
    : Array.isArray(recap)
      ? recap
      : [];

  if (calendarError) {
    return <ErrorCard message="Unable to load governance calendar." onRetry={refetchCalendar} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Governance Calendar</h3>
      </div>

      {/* Current epoch hero */}
      {calendarLoading ? (
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-3">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : calendar ? (
        <EpochProgressHero calendar={calendar} countdown={countdown} />
      ) : null}

      {/* Participation trend mini-chart */}
      {participationRows.length >= 4 && (
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
              Participation Trend
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-1 w-3 rounded-full bg-blue-400" />
                Participation
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1 w-3 rounded-full bg-emerald-400 opacity-70" />
                Rationale
              </span>
            </div>
          </div>
          <div className="flex items-end gap-[2px] h-12">
            {(() => {
              const maxVal = Math.max(
                ...participationRows.map((r) =>
                  Math.max(r.participation_rate, r.rationale_rate ?? 0),
                ),
                1,
              );
              return participationRows.slice(-20).map((r) => {
                const pRate = r.participation_rate ?? 0;
                const rRate = r.rationale_rate ?? 0;
                return (
                  <div
                    key={r.epoch}
                    className="flex-1 flex items-end gap-[1px]"
                    title={`Epoch ${r.epoch}: ${pRate.toFixed(1)}% participation, ${rRate.toFixed(1)}% rationale`}
                  >
                    <div
                      className="flex-1 bg-blue-400/70 rounded-t-sm min-w-[1px]"
                      style={{ height: `${Math.max(2, (pRate / maxVal) * 100)}%` }}
                    />
                    <div
                      className="flex-1 bg-emerald-400/70 rounded-t-sm min-w-[1px]"
                      style={{ height: `${Math.max(2, (rRate / maxVal) * 100)}%` }}
                    />
                  </div>
                );
              });
            })()}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>Ep {participationRows[Math.max(0, participationRows.length - 20)]?.epoch}</span>
            <span>Ep {participationRows[participationRows.length - 1]?.epoch}</span>
          </div>
        </div>
      )}

      {/* Upcoming proposal deadlines */}
      {calendar && calendar.upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Upcoming Deadlines
          </p>
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md divide-y divide-border overflow-hidden">
            {calendar.upcoming.map((p) => (
              <ProposalDeadline key={`${p.txHash}-${p.index}`} proposal={p} />
            ))}
          </div>
        </div>
      )}

      {/* Active proposals context */}
      {((pulse?.activeProposals as number | undefined) ?? 0) > 0 && (
        <Link
          href="/governance/proposals"
          className="flex items-center justify-between rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 hover:border-primary/30 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium">
              {pulse!.activeProposals as React.ReactNode} open proposal
              {((pulse!.activeProposals as number | undefined) ?? 0) > 1 ? 's' : ''} in voting
            </p>
            <p className="text-xs text-muted-foreground">
              {(pulse!.votesThisWeek as number | undefined)?.toLocaleString() ?? 0} votes cast this
              week
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      )}

      {/* Past epoch recaps */}
      {epochRecaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Past Epochs
          </p>
          <div className="space-y-2">
            {epochRecaps.slice(0, 5).map((r) => (
              <EpochRecapCard key={(r.epoch as number) ?? (r.id as string)} recap={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
