'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { posthog } from '@/lib/posthog';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Vote,
  Landmark,
  Activity,
  ArrowUp,
  ArrowDown,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/* ── Types ──────────────────────────────────────────────────────── */

interface EpochBriefingProps {
  drepId: string | null | undefined;
  wallet: string | null | undefined;
}

/* ── Data hook ──────────────────────────────────────────────────── */

function useCitizenBriefing(wallet: string | null | undefined) {
  return useQuery({
    queryKey: ['citizen-briefing', wallet],
    queryFn: async () => {
      const url = wallet
        ? `/api/briefing/citizen?wallet=${encodeURIComponent(wallet)}`
        : '/api/briefing/citizen';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatAdaCompact(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

const HEALTH_CONFIG = {
  green: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
  },
  yellow: {
    bg: 'bg-amber-500/10 border-amber-500/20',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  red: {
    bg: 'bg-rose-500/10 border-rose-500/20',
    icon: AlertCircle,
    iconColor: 'text-rose-500',
  },
} as const;

type HealthLevel = keyof typeof HEALTH_CONFIG;

const HEADLINE_ICONS: Record<string, typeof Vote> = {
  proposal: Vote,
  treasury: Landmark,
  governance: Activity,
};

/* ── Skeleton (loading state) ───────────────────────────────────── */

function BriefingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Status banner skeleton */}
      <div className="rounded-xl border p-4">
        <Skeleton className="h-5 w-3/4" />
      </div>
      {/* Card skeletons */}
      <div className="rounded-xl border p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      {/* Stats row skeleton */}
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function EpochBriefing({ wallet }: EpochBriefingProps) {
  const { data, isLoading, isError } = useCitizenBriefing(wallet);
  const tracked = useRef(false);

  useEffect(() => {
    if (data && !tracked.current) {
      tracked.current = true;
      posthog?.capture('citizen_briefing_viewed', {
        epoch: data.epoch,
        health: data.status?.health,
        has_drep: !!data.drepPerformance,
      });
    }
  }, [data]);

  if (isLoading) return <BriefingSkeleton />;

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Unable to load your briefing right now.
      </p>
    );
  }

  if (!data) return null;

  const health: HealthLevel = data.status?.health ?? 'green';
  const config = HEALTH_CONFIG[health];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-4">
      {/* ── Section 1: Status Banner ────────────────────────────────── */}
      <div className={cn('rounded-xl border p-4 flex items-center gap-3', config.bg)}>
        <StatusIcon className={cn('h-5 w-5 shrink-0', config.iconColor)} />
        <p className="flex-1 text-sm font-semibold text-foreground">
          {data.status?.headline ?? 'Governance is active'}
        </p>
        {data.status?.delegatedTo ? (
          <Link
            href={`/drep/${data.status.delegatedTo.id}`}
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            {data.status.delegatedTo.name}
            {data.status.delegatedTo.score != null && (
              <span className="ml-1.5 tabular-nums text-muted-foreground">
                {data.status.delegatedTo.score}
              </span>
            )}
          </Link>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href="/match">Find My DRep</Link>
          </Button>
        )}
      </div>

      {/* ── Section 2: What Happened ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Epoch {data.epoch}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.recap?.narrative && (
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              {data.recap.narrative}
            </p>
          )}
          {data.headlines && data.headlines.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.headlines
                .slice(0, 4)
                .map((h: { type: string; title: string; description: string }, i: number) => {
                  const HeadlineIcon = HEADLINE_ICONS[h.type] ?? Activity;
                  return (
                    <div
                      key={i}
                      className="flex gap-3 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <HeadlineIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{h.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {h.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Your DRep This Epoch ─────────────────────────── */}
      {data.drepPerformance && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Your DRep this epoch
                </p>
                <Link
                  href={`/drep/${data.drepPerformance.id}`}
                  className="text-base font-semibold text-foreground hover:text-primary transition-colors truncate block"
                >
                  {data.drepPerformance.name}
                </Link>
                {data.drepPerformance.verdict && (
                  <p className="text-sm text-muted-foreground">{data.drepPerformance.verdict}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p
                  className={cn(
                    'font-display text-3xl font-bold tabular-nums',
                    data.drepPerformance.score >= 70
                      ? 'text-emerald-500'
                      : data.drepPerformance.score >= 40
                        ? 'text-amber-500'
                        : 'text-rose-500',
                  )}
                >
                  {data.drepPerformance.score}
                </p>
                {data.drepPerformance.scoreChange != null &&
                  data.drepPerformance.scoreChange !== 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 text-xs font-medium',
                        data.drepPerformance.scoreChange > 0 ? 'text-emerald-500' : 'text-rose-500',
                      )}
                    >
                      {data.drepPerformance.scoreChange > 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.abs(data.drepPerformance.scoreChange)}
                    </span>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Votes cast',
                  value: data.drepPerformance.votesCast ?? 0,
                },
                {
                  label: 'Rationales',
                  value: data.drepPerformance.rationales ?? 0,
                },
                {
                  label: 'Participation',
                  value:
                    data.drepPerformance.participationRate != null
                      ? `${data.drepPerformance.participationRate}%`
                      : '--',
                },
              ].map((stat) => (
                <div key={stat.label} className="text-center rounded-lg bg-muted/30 py-2">
                  <p className="text-base font-semibold tabular-nums text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 4: Treasury Snapshot ─────────────────────────────── */}
      {data.treasury && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Treasury</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-base font-semibold tabular-nums text-foreground">
                  {formatAdaCompact(data.treasury.balance)}
                </p>
                <p className="text-[10px] text-muted-foreground">Balance</p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold tabular-nums text-foreground">
                  {formatAdaCompact(data.treasury.withdrawnThisEpoch ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Withdrawn</p>
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'text-base font-semibold tabular-nums',
                    (data.treasury.pendingProposals ?? 0) > 0
                      ? 'text-amber-500'
                      : 'text-foreground',
                  )}
                >
                  {data.treasury.pendingProposals ?? 0}
                </p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 5: What's Coming ────────────────────────────────── */}
      {data.upcoming && data.upcoming.activeProposals > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Vote className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-semibold">{data.upcoming.activeProposals}</span> proposal
              {data.upcoming.activeProposals !== 1 ? 's are' : ' is'} open for voting
            </span>
            {data.upcoming.critical > 0 && (
              <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20">
                {data.upcoming.critical} critical
              </Badge>
            )}
          </div>
          <Link
            href="/discover"
            className="shrink-0 text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
