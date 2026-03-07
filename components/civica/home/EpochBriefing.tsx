'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { posthog } from '@/lib/posthog';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Vote,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Calendar,
  Flame,
  Coins,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTreasuryCurrent, useTreasuryPending } from '@/hooks/queries';

/* ── Types ──────────────────────────────────────────────────────── */

interface EpochBriefingProps {
  drepId: string | null | undefined;
  wallet: string | null | undefined;
}

/* ── Data hooks ─────────────────────────────────────────────────── */

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

function useCivicIdentity(wallet: string | null | undefined) {
  return useQuery({
    queryKey: ['civic-identity', wallet],
    queryFn: async () => {
      const res = await fetch(`/api/governance/footprint?wallet=${encodeURIComponent(wallet!)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!wallet,
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
  green: { icon: CheckCircle2, iconColor: 'text-emerald-500' },
  yellow: { icon: AlertTriangle, iconColor: 'text-amber-500' },
  red: { icon: AlertCircle, iconColor: 'text-rose-500' },
} as const;

type HealthLevel = keyof typeof HEALTH_CONFIG;

/* ── Skeleton ──────────────────────────────────────────────────── */

function BriefingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function EpochBriefing({ wallet }: EpochBriefingProps) {
  const { data, isLoading, isError } = useCitizenBriefing(wallet);
  const { data: identity } = useCivicIdentity(wallet);
  const { data: rawTreasury } = useTreasuryCurrent();
  const { data: rawPending } = useTreasuryPending();
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
  const treasury = rawTreasury as
    | { balance?: number; runwayMonths?: number; trend?: string }
    | undefined;
  const pending = rawPending as
    | {
        proposals?: {
          txHash?: string;
          tx_hash?: string;
          index?: number;
          title?: string;
          proposalType?: string;
          withdrawalAda?: number;
        }[];
      }
    | undefined;
  const pendingProposals = Array.isArray(pending?.proposals) ? pending.proposals.slice(0, 3) : [];

  return (
    <article className="space-y-0">
      {/* ── Briefing Header ───────────────────────────────────────── */}
      <header className="pb-5 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Your Governance Briefing
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-1">
          Epoch {data.epoch}
        </h1>
      </header>

      {/* ── Status Banner ─────────────────────────────────────────── */}
      <div className="py-4 border-b border-border flex items-center gap-3">
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
          </Link>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href="/match">Find My DRep</Link>
          </Button>
        )}
      </div>

      {/* ── The Lead (AI narrative) ───────────────────────────────── */}
      {data.recap?.narrative && (
        <div className="py-5 border-b border-border">
          <p className="text-base sm:text-lg leading-relaxed text-foreground">
            {data.recap.narrative}
          </p>
        </div>
      )}

      {/* ── What Happened (headlines) ─────────────────────────────── */}
      {data.headlines && data.headlines.length > 0 && (
        <div className="py-5 border-b border-border space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            What happened
          </p>
          <ul className="space-y-2.5">
            {data.headlines
              .slice(0, 4)
              .map((h: { type: string; title: string; description: string }, i: number) => (
                <li key={i} className="flex gap-3">
                  <span className="text-primary font-bold text-lg leading-none mt-0.5">&bull;</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{h.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* ── Your DRep This Epoch ──────────────────────────────────── */}
      {data.drepPerformance && (
        <div className="py-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Your DRep this epoch
          </p>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/drep/${data.drepPerformance.id}`}
                className="text-base font-semibold text-foreground hover:text-primary transition-colors"
              >
                {data.drepPerformance.name}
              </Link>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.drepPerformance.verdict}
                {' \u00B7 '}
                {data.drepPerformance.votesCast ?? 0} vote
                {(data.drepPerformance.votesCast ?? 0) !== 1 ? 's' : ''} cast
                {(data.drepPerformance.rationales ?? 0) > 0 &&
                  `, ${data.drepPerformance.rationales} rationale${(data.drepPerformance.rationales ?? 0) !== 1 ? 's' : ''}`}
                {data.drepPerformance.participationRate != null &&
                  ` \u00B7 ${data.drepPerformance.participationRate}% participation`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={cn(
                  'font-display text-2xl font-bold tabular-nums',
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
        </div>
      )}

      {/* ── Treasury ──────────────────────────────────────────────── */}
      <div className="py-5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Where your money goes
          </p>
          <Link
            href="/pulse"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Full details
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {formatAdaCompact(treasury?.balance ?? data.treasury?.balanceAda ?? 0)} ADA
          <span className="text-sm font-normal text-muted-foreground ml-2">in the treasury</span>
        </p>
        {treasury?.runwayMonths != null && (
          <p className="text-sm text-muted-foreground mt-1">
            {treasury.runwayMonths >= 999
              ? '10+ year runway'
              : `${Math.round(treasury.runwayMonths / 12)} year runway`}
            {' at current spending rate'}
          </p>
        )}
        {data.treasury?.proportionalShareAda != null && data.treasury.proportionalShareAda > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            Your DRep&apos;s {formatAdaCompact(data.treasury.drepDelegatedAda ?? 0)} ADA delegation
            represents{' '}
            <span className="font-medium text-foreground">
              {formatAdaCompact(data.treasury.proportionalShareAda)} ADA
            </span>{' '}
            of the treasury
          </p>
        )}
        {pendingProposals.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Awaiting decision</p>
            {pendingProposals.map((item, idx) => (
              <Link
                key={idx}
                href={`/proposal/${item.txHash ?? item.tx_hash}/${item.index ?? 0}`}
                className="flex items-center justify-between py-1.5 group"
              >
                <span className="text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {item.title ?? item.proposalType ?? 'Treasury withdrawal'}
                  {item.withdrawalAda != null && (
                    <span className="text-muted-foreground ml-1.5">
                      ({formatAdaCompact(item.withdrawalAda)} ADA)
                    </span>
                  )}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        )}
        {pendingProposals.length === 0 && (data.treasury?.pendingProposals ?? 0) > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {data.treasury.pendingProposals} proposal
            {data.treasury.pendingProposals !== 1 ? 's' : ''} requesting funds
          </p>
        )}
      </div>

      {/* ── What's Coming ─────────────────────────────────────────── */}
      {data.upcoming && data.upcoming.activeProposals > 0 && (
        <div className="py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Vote className="h-4 w-4 text-muted-foreground" />
              <span>
                <span className="font-semibold">{data.upcoming.activeProposals}</span> proposal
                {data.upcoming.activeProposals !== 1 ? 's' : ''} open for voting
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
        </div>
      )}

      {/* ── Civic Identity (compact strip) ────────────────────────── */}
      {identity && (
        <div className="pt-5 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {identity.citizenSinceEpoch != null && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Citizen since Epoch {identity.citizenSinceEpoch}
            </span>
          )}
          {identity.delegationStreak != null && identity.delegationStreak > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              {identity.delegationStreak} epoch streak
            </span>
          )}
          {identity.proposalsInfluenced != null && identity.proposalsInfluenced > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5" />
              {identity.proposalsInfluenced} proposals influenced
            </span>
          )}
          {identity.adaGoverned != null && (
            <span className="inline-flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" />
              {formatAdaCompact(identity.adaGoverned)} ADA governed
            </span>
          )}
        </div>
      )}
    </article>
  );
}
