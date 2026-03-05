'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useGovernancePulse, useGovernanceEpochRecap } from '@/hooks/queries';

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
      href={`/proposals/${proposal.txHash}/${proposal.index}`}
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

function EpochRecapCard({ recap }: { recap: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tabular-nums text-muted-foreground">
            {recap.epoch}
          </span>
          <div>
            <p className="text-sm font-medium">
              {recap.proposalsRatified ?? 0} ratified
              {recap.adaWithdrawn ? ` · ₳${formatAda(recap.adaWithdrawn)} withdrawn` : ''}
            </p>
            {recap.ghiDelta != null && (
              <p className="text-[11px] text-muted-foreground">
                GHI {recap.ghiDelta > 0 ? `+${recap.ghiDelta}` : recap.ghiDelta}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && recap.summary && (
        <div className="px-4 pb-3 text-xs text-muted-foreground border-t border-border pt-2">
          {recap.summary}
        </div>
      )}
    </div>
  );
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return `${Math.round(ada)}`;
}

export function CivicaGovernanceCalendar() {
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);

  const { data: rawPulse } = useGovernancePulse();
  const { data: rawRecap } = useGovernanceEpochRecap();
  const pulse = rawPulse as any;
  const recap = rawRecap as any;

  useEffect(() => {
    setCalendarLoading(true);
    fetch('/api/governance/calendar')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setCalendar(d);
          setCountdown(d.secondsRemaining);
        }
      })
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
  }, []);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const epochRecaps: any[] = Array.isArray(recap?.recaps)
    ? recap.recaps
    : Array.isArray(recap)
      ? recap
      : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Governance Calendar</h3>
      </div>

      {/* Current epoch hero */}
      {calendarLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : calendar ? (
        <EpochProgressHero calendar={calendar} countdown={countdown} />
      ) : null}

      {/* Upcoming proposal deadlines */}
      {calendar && calendar.upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Upcoming Deadlines
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {calendar.upcoming.map((p) => (
              <ProposalDeadline key={`${p.txHash}-${p.index}`} proposal={p} />
            ))}
          </div>
        </div>
      )}

      {/* Active proposals context */}
      {pulse?.activeProposals > 0 && (
        <Link
          href="/proposals"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium">
              {pulse.activeProposals} open proposal
              {pulse.activeProposals > 1 ? 's' : ''} in voting
            </p>
            <p className="text-xs text-muted-foreground">
              {pulse.votesThisWeek?.toLocaleString() ?? 0} votes cast this week
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
            {epochRecaps.slice(0, 5).map((r: any) => (
              <EpochRecapCard key={r.epoch ?? r.id} recap={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
