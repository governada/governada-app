'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { posthog } from '@/lib/posthog';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Vote,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Calendar,
  Flame,
  Coins,
  ExternalLink,
  Megaphone,
  Trophy,
  Clock,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AsyncContent } from '@/components/ui/AsyncContent';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useTreasuryCurrent,
  useTreasuryPending,
  useTreasuryNcl,
  useGovernanceCalendar,
} from '@/hooks/queries';
import type { NclUtilization } from '@/lib/treasury';
import { briefingContainer, briefingItem } from '@/lib/animations';
import { GovTerm } from '@/components/ui/GovTerm';
import {
  useCitizenVoice,
  useEndorsements,
  type CitizenVoiceProposal,
  type CitizenVoiceData,
} from '@/hooks/useEngagement';

/* ── Types ──────────────────────────────────────────────────────── */

interface EpochBriefingProps {
  wallet: string | null | undefined;
}

interface BriefingSection {
  id: string;
  label: string;
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

/* ── Swipe navigation hook ─────────────────────────────────────── */

function useSwipeNavigation(
  sectionCount: number,
  activeIndex: number,
  onNavigate: (index: number) => void,
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && activeIndex < sectionCount - 1) onNavigate(activeIndex + 1);
        else if (dx > 0 && activeIndex > 0) onNavigate(activeIndex - 1);
      }
      touchStart.current = null;
    },
    [activeIndex, sectionCount, onNavigate],
  );

  return { onTouchStart, onTouchEnd };
}

/* ── Mobile section tab pills ──────────────────────────────────── */

function SectionTabs({
  sections,
  activeIndex,
  onSelect,
}: {
  sections: BriefingSection[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <nav
      className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1"
      aria-label="Briefing sections"
    >
      {sections.map((section, i) => (
        <button
          key={section.id}
          onClick={() => onSelect(i)}
          aria-current={i === activeIndex ? 'true' : undefined}
          className={cn(
            'shrink-0 rounded-full text-xs font-medium transition-colors',
            'min-h-[36px] px-3 py-2 [touch-action:manipulation]',
            i === activeIndex
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/40 text-muted-foreground active:bg-muted/60',
          )}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

/* ── Mobile dot indicators ─────────────────────────────────────── */

function DotIndicators({ count, activeIndex }: { count: number; activeIndex: number }) {
  if (count <= 1) return null;
  return (
    <div className="flex justify-center gap-1.5 py-1" aria-label="Section indicator">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all duration-200',
            i === activeIndex ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  );
}

/* ── Slide animation variants ──────────────────────────────────── */

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    opacity: 0,
  }),
};

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
  const briefingQuery = useCitizenBriefing(wallet);
  const { data: identity } = useCivicIdentity(wallet);
  const { data: rawTreasury, dataUpdatedAt } = useTreasuryCurrent();
  const { data: rawPending } = useTreasuryPending();
  const { data: nclRaw } = useTreasuryNcl();
  const { data: voiceData } = useCitizenVoice(wallet);
  const { data: calendarRaw } = useGovernanceCalendar();
  const calendar = calendarRaw as
    | { currentEpoch?: number; secondsRemaining?: number; epochProgress?: number }
    | undefined;

  return (
    <AsyncContent
      query={briefingQuery}
      skeleton={<BriefingSkeleton />}
      errorMessage="Couldn't load your briefing"
    >
      {(data) => (
        <EpochBriefingContent
          data={data as EpochBriefingData}
          identity={identity as Record<string, unknown> | null}
          rawTreasury={rawTreasury}
          rawPending={rawPending}
          nclUtilization={(nclRaw as { ncl: NclUtilization | null } | undefined)?.ncl ?? null}
          voiceData={voiceData}
          epochSecondsRemaining={calendar?.secondsRemaining ?? null}
          epochProgress={calendar?.epochProgress ?? null}
          dataUpdatedAt={briefingQuery.dataUpdatedAt || dataUpdatedAt || 0}
        />
      )}
    </AsyncContent>
  );
}

/* ── Content component (extracted for AsyncContent) ──────────── */

interface EpochBriefingDRepPerformance {
  id: string;
  name: string;
  verdict?: string;
  votesCast?: number;
  rationales?: number;
  participationRate?: number;
  score: number;
  scoreChange?: number;
}

interface EpochBriefingData {
  epoch: number;
  status?: {
    health?: string;
    headline?: string;
    delegatedTo?: { id: string; name: string } | null;
    drepDeregistered?: boolean;
  };
  recap?: { narrative?: string };
  headlines?: { type: string; title: string; description: string; nclContext?: string }[];
  drepPerformance?: EpochBriefingDRepPerformance;
  treasury?: {
    balanceAda?: number;
    proportionalShareAda?: number;
    drepDelegatedAda?: number;
    pendingProposals?: number;
  };
  upcoming?: {
    activeProposals?: number;
    critical?: number;
  };
  [key: string]: unknown;
}

function formatCountdownCompact(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function formatTimeAgo(timestamp: number): string | null {
  if (!timestamp) return null;
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function EpochBriefingContent({
  data,
  identity,
  rawTreasury,
  rawPending,
  nclUtilization,
  voiceData,
  epochSecondsRemaining,
  epochProgress,
  dataUpdatedAt,
}: {
  data: EpochBriefingData;
  identity: Record<string, unknown> | null;
  rawTreasury: unknown;
  rawPending: unknown;
  nclUtilization: NclUtilization | null;
  voiceData: CitizenVoiceData | undefined | null;
  epochSecondsRemaining: number | null;
  epochProgress: number | null;
  dataUpdatedAt: number;
}) {
  const tracked = useRef(false);
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState(0);
  const [direction, setDirection] = useState(0);
  const { data: drepEndorsements } = useEndorsements('drep', data?.drepPerformance?.id ?? '');

  const sections = useMemo<BriefingSection[]>(() => {
    if (!data) return [];
    const s: BriefingSection[] = [{ id: 'headlines', label: 'What Happened' }];
    if (data.drepPerformance) s.push({ id: 'drep', label: 'Your DRep' });
    s.push({ id: 'treasury', label: 'Treasury' });
    return s;
  }, [data]);

  const navigateSection = useCallback(
    (index: number) => {
      setDirection(index > activeSection ? 1 : -1);
      setActiveSection(index);
    },
    [activeSection],
  );

  const swipeHandlers = useSwipeNavigation(sections.length, activeSection, navigateSection);

  useEffect(() => {
    if (data && !tracked.current) {
      tracked.current = true;
      posthog?.capture('citizen_briefing_viewed', {
        epoch: data.epoch,
        health: data.status?.health,
        has_drep: !!data.drepPerformance,
        drep_deregistered: !!data.status?.drepDeregistered,
      });
    }
  }, [data]);

  const health: HealthLevel = (data.status?.health as HealthLevel) ?? 'green';
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

  /* ── Shared section content ──────────────────────────────────── */

  const freshness = formatTimeAgo(dataUpdatedAt);

  const briefingHeader = (
    <header className="pb-5 border-b border-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Your Governance Briefing
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-1">
            Epoch {data.epoch}
          </h1>
        </div>
        {epochSecondsRemaining != null && epochSecondsRemaining > 0 && (
          <div className="text-right shrink-0 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">{formatCountdownCompact(epochSecondsRemaining)}</span>
            </div>
            {epochProgress != null && (
              <div className="mt-1.5 w-16 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${epochProgress}%` }}
                />
              </div>
            )}
            {freshness && (
              <p className="text-[10px] text-muted-foreground/60 mt-1 tabular-nums">{freshness}</p>
            )}
          </div>
        )}
      </div>
    </header>
  );

  const statusBanner = (
    <div
      className={cn(
        'py-4 border-b border-border',
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3',
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <StatusIcon className={cn('h-5 w-5 shrink-0', config.iconColor)} aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">
          {data.status?.headline ?? 'Governance is active'}
        </p>
      </div>
      {data.status?.delegatedTo ? (
        <Link
          href={`/drep/${data.status.delegatedTo.id}`}
          className={cn(
            'shrink-0 text-sm font-medium text-primary hover:underline',
            'ml-8 sm:ml-0 min-h-[44px] sm:min-h-0 inline-flex items-center',
          )}
        >
          {data.status.delegatedTo.name}
        </Link>
      ) : (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="self-start sm:self-auto ml-8 sm:ml-0"
        >
          <Link href="/match">Find My DRep</Link>
        </Button>
      )}
    </div>
  );

  const deregisteredAlert = data.status?.drepDeregistered ? (
    <div
      className="py-4 border-b border-rose-500/30"
      role="alert"
      aria-label="DRep deregistered alert"
    >
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-semibold text-rose-500">Your DRep has deregistered</p>
            <p className="text-sm text-muted-foreground">
              {data.status.delegatedTo?.name
                ? `${data.status.delegatedTo.name} is`
                : 'Your representative is'}{' '}
              no longer an active DRep. Your delegation is void and your ADA is unrepresented in
              governance votes.
            </p>
            <Button asChild size="sm" className="mt-1">
              <Link href="/match">Find a new DRep</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const milestoneCelebration = (identity?.recentMilestone as string | undefined) ? (
    <div className="py-4 border-b border-border">
      <Link
        href="/you"
        className="group block rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 p-4 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/20 shrink-0">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              Milestone unlocked!
            </p>
            <p className="text-base font-medium text-foreground mt-1">
              {identity!.recentMilestone as React.ReactNode}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 group-hover:text-primary transition-colors inline-flex items-center gap-1">
              View your civic identity
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </div>
      </Link>
    </div>
  ) : null;

  const narrativeSection = data.recap?.narrative ? (
    <div className="py-5 border-b border-border">
      <p className="text-base sm:text-lg leading-relaxed text-foreground">{data.recap.narrative}</p>
    </div>
  ) : null;

  const headlinesSection =
    data.headlines && data.headlines.length > 0 ? (
      <div className="py-5 border-b border-border space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          What happened
        </p>
        <ul className="space-y-2.5">
          {data.headlines
            .slice(0, 4)
            .map(
              (
                h: { type: string; title: string; description: string; nclContext?: string },
                i: number,
              ) => (
                <li key={i} className="flex gap-3 min-h-[44px] items-start">
                  <span className="text-primary font-bold text-lg leading-none mt-0.5">&bull;</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{h.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>
                    {h.nclContext && (
                      <p className="text-xs text-amber-500/80 mt-0.5 flex items-center gap-1">
                        <Coins className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {h.nclContext}
                      </p>
                    )}
                  </div>
                </li>
              ),
            )}
        </ul>
      </div>
    ) : null;

  const drepSection = data.drepPerformance ? (
    <div className="py-5 border-b border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Your DRep this epoch
      </p>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/drep/${data.drepPerformance.id}`}
            className="text-base font-semibold text-foreground hover:text-primary transition-colors min-h-[44px] inline-flex items-center"
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
          {drepEndorsements && drepEndorsements.total > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {drepEndorsements.total} citizen endorsement
              {drepEndorsements.total !== 1 ? 's' : ''}
              {drepEndorsements.userEndorsements.length > 0 && (
                <span className="text-primary"> (including yours)</span>
              )}
            </p>
          )}
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
          {data.drepPerformance.scoreChange != null && data.drepPerformance.scoreChange !== 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                data.drepPerformance.scoreChange > 0 ? 'text-emerald-500' : 'text-rose-500',
              )}
              aria-label={`Score ${data.drepPerformance.scoreChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(data.drepPerformance.scoreChange)}`}
            >
              {data.drepPerformance.scoreChange > 0 ? (
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              )}
              {Math.abs(data.drepPerformance.scoreChange)}
            </span>
          )}
        </div>
      </div>
    </div>
  ) : null;

  /* ── Your Voice This Epoch ──────────────────────────────────── */

  const voiceSection =
    voiceData && voiceData.summary && voiceData.summary.totalVotes > 0 ? (
      <div className="py-5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Your voice this epoch
          </p>
          <Link
            href="/engage"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Engage
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-sm text-foreground mb-3">
          You shared your opinion on{' '}
          <span className="font-semibold">
            {voiceData.summary.totalVotes} proposal
            {voiceData.summary.totalVotes !== 1 ? 's' : ''}
          </span>
          {voiceData.summary.avgCommunityAgreement != null && (
            <>
              {' \u00B7 '}
              <span className="font-semibold">{voiceData.summary.avgCommunityAgreement}%</span>{' '}
              community agreement
            </>
          )}
          {(voiceData.summary.drepAligned > 0 || voiceData.summary.drepDiverged > 0) && (
            <>
              {' \u00B7 '}
              DRep aligned on{' '}
              <span className="font-semibold">
                {voiceData.summary.drepAligned} of{' '}
                {voiceData.summary.drepAligned + voiceData.summary.drepDiverged}
              </span>
            </>
          )}
        </p>
        <ul className="space-y-1.5">
          {voiceData.proposals.slice(0, 3).map((p: CitizenVoiceProposal) => (
            <li key={`${p.txHash}:${p.index}`}>
              <Link
                href={`/proposal/${p.txHash}/${p.index}`}
                className="flex items-center justify-between py-1 group text-sm"
              >
                <span className="text-foreground group-hover:text-primary transition-colors truncate min-w-0">
                  <Megaphone className="h-3 w-3 inline mr-1.5 text-muted-foreground" />
                  {p.title ?? p.proposalType ?? 'Proposal'}
                </span>
                <span className="shrink-0 ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {p.communityAgreement != null && <span>{p.communityAgreement}% agreed</span>}
                  {p.drepAligned != null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0',
                        p.drepAligned
                          ? 'text-emerald-500 border-emerald-500/30'
                          : 'text-rose-500 border-rose-500/30',
                      )}
                    >
                      {p.drepAligned ? 'DRep aligned' : 'DRep diverged'}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0',
                      p.outcome === 'ratified'
                        ? 'text-emerald-500 border-emerald-500/30'
                        : p.outcome === 'dropped'
                          ? 'text-rose-500 border-rose-500/30'
                          : 'text-muted-foreground',
                    )}
                  >
                    {p.outcome}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const treasurySection = (
    <div className="py-5 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Where your money goes
        </p>
        <Link
          href="/governance/health"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 min-h-[44px] sm:min-h-0"
        >
          Full details
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">
        {formatAdaCompact(treasury?.balance ?? data.treasury?.balanceAda ?? 0)} ADA
        <span className="text-sm font-normal text-muted-foreground ml-2">
          in the <GovTerm term="treasury">treasury</GovTerm>
        </span>
      </p>
      {treasury?.runwayMonths != null && (
        <p className="text-sm text-muted-foreground mt-1">
          {treasury.runwayMonths >= 999
            ? '10+ year '
            : `${Math.round(treasury.runwayMonths / 12)} year `}
          <GovTerm term="runway">runway</GovTerm>
          {' at current spending rate'}
        </p>
      )}
      {nclUtilization && (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Budget:{' '}
              <span
                className={cn(
                  'font-semibold',
                  nclUtilization.status === 'critical'
                    ? 'text-red-400'
                    : nclUtilization.status === 'elevated'
                      ? 'text-amber-400'
                      : 'text-emerald-400',
                )}
              >
                {Math.round(nclUtilization.utilizationPct)}% used
              </span>{' '}
              of ₳{formatAdaCompact(nclUtilization.period.nclAda)} limit
            </span>
            <span className="text-muted-foreground/60 tabular-nums">
              {nclUtilization.epochsRemaining} epochs left
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                nclUtilization.status === 'critical'
                  ? 'bg-red-500'
                  : nclUtilization.status === 'elevated'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500',
              )}
              style={{ width: `${Math.min(nclUtilization.utilizationPct, 100)}%` }}
            />
          </div>
        </div>
      )}
      {data.treasury?.proportionalShareAda != null && data.treasury.proportionalShareAda > 0 && (
        <p className="text-sm text-muted-foreground mt-1">
          Your DRep&apos;s {formatAdaCompact(data.treasury.drepDelegatedAda ?? 0)} ADA{' '}
          <GovTerm term="delegation">delegation</GovTerm> represents{' '}
          <span className="font-medium text-foreground">
            {formatAdaCompact(data.treasury.proportionalShareAda)} ADA
          </span>{' '}
          <GovTerm term="proportional share">of the treasury</GovTerm>
        </p>
      )}
      {pendingProposals.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Awaiting decision</p>
          {pendingProposals.map((item, idx) => (
            <Link
              key={idx}
              href={`/proposal/${item.txHash ?? item.tx_hash}/${item.index ?? 0}`}
              className="flex items-center justify-between py-1.5 group min-h-[44px]"
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
          {data.treasury!.pendingProposals} proposal
          {data.treasury!.pendingProposals !== 1 ? 's' : ''} requesting funds
        </p>
      )}
    </div>
  );

  const upcomingSection =
    data.upcoming && (data.upcoming.activeProposals ?? 0) > 0 ? (
      <div className="py-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground flex-1 min-w-0">
            <Vote className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{data.upcoming.activeProposals}</span> proposal
              {(data.upcoming.activeProposals ?? 0) !== 1 ? 's' : ''} open
            </span>
            {(data.upcoming.critical ?? 0) > 0 && (
              <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 shrink-0">
                {data.upcoming.critical} critical
              </Badge>
            )}
          </div>
          <Link
            href="/governance/proposals"
            className="shrink-0 text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 min-h-[44px]"
          >
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    ) : null;

  const civicIdentityStrip = identity ? (
    <Link
      href="/my-gov/identity"
      className={cn(
        'group block pt-5 -mx-4 px-4 rounded-lg transition-colors',
        identity.delegationStreak != null && (identity.delegationStreak as number) >= 5
          ? 'bg-amber-500/5 hover:bg-amber-500/10'
          : 'hover:bg-muted/30',
      )}
    >
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {identity.citizenSinceEpoch != null && (
          <span className="inline-flex items-center gap-1.5 min-h-[36px]">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Citizen since Epoch {identity.citizenSinceEpoch as React.ReactNode}
          </span>
        )}
        {identity.delegationStreak != null && (identity.delegationStreak as number) > 0 && (
          <span className="inline-flex items-center gap-1.5 min-h-[36px]">
            <Flame
              className={cn(
                'text-amber-500 animate-pulse',
                (identity.delegationStreak as number) >= 8
                  ? 'h-5 w-5'
                  : (identity.delegationStreak as number) >= 4
                    ? 'h-4 w-4'
                    : 'h-3.5 w-3.5',
              )}
              aria-hidden="true"
            />
            {identity.delegationStreak as React.ReactNode} epoch streak
          </span>
        )}
        {identity.proposalsInfluenced != null && (identity.proposalsInfluenced as number) > 0 && (
          <span className="inline-flex items-center gap-1.5 min-h-[36px]">
            <Vote className="h-3.5 w-3.5" aria-hidden="true" />
            {identity.proposalsInfluenced as React.ReactNode} proposals influenced
          </span>
        )}
        {identity.adaGoverned != null && (
          <span className="inline-flex items-center gap-1.5 min-h-[36px]">
            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
            {formatAdaCompact(identity.adaGoverned as number)} ADA governed
          </span>
        )}
      </div>
      {(identity.recentMilestone as string | undefined) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Trophy className="h-3.5 w-3.5 text-amber-500 animate-bounce" aria-hidden="true" />
          <span className="font-medium text-foreground">
            {identity.recentMilestone as React.ReactNode}
          </span>
        </div>
      )}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        View your civic identity
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  ) : null;

  /* ── Mobile: swipeable section carousel ─────────────────────── */

  if (isMobile && sections.length > 1) {
    const renderActiveSection = () => {
      switch (sections[activeSection]?.id) {
        case 'headlines':
          return (
            <>
              {narrativeSection}
              {headlinesSection}
            </>
          );
        case 'drep':
          return drepSection;
        case 'treasury':
          return (
            <>
              {voiceSection}
              {treasurySection}
              {upcomingSection}
            </>
          );
        default:
          return null;
      }
    };

    return (
      <article className="space-y-0">
        {briefingHeader}
        {statusBanner}
        {deregisteredAlert}
        {milestoneCelebration}

        <div className="py-3">
          <SectionTabs sections={sections} activeIndex={activeSection} onSelect={navigateSection} />
        </div>

        <div className="overflow-hidden" {...swipeHandlers}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={sections[activeSection]?.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {renderActiveSection()}
            </motion.div>
          </AnimatePresence>
        </div>

        <DotIndicators count={sections.length} activeIndex={activeSection} />

        {civicIdentityStrip}
      </article>
    );
  }

  /* ── Desktop: vertical stacked layout ───────────────────────── */

  return (
    <motion.article
      className="space-y-0"
      variants={briefingContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={briefingItem}>{briefingHeader}</motion.div>
      <motion.div variants={briefingItem}>{statusBanner}</motion.div>
      {deregisteredAlert && <motion.div variants={briefingItem}>{deregisteredAlert}</motion.div>}
      {milestoneCelebration && (
        <motion.div variants={briefingItem}>{milestoneCelebration}</motion.div>
      )}
      <motion.div variants={briefingItem}>{narrativeSection}</motion.div>
      <motion.div variants={briefingItem}>{headlinesSection}</motion.div>
      <motion.div variants={briefingItem}>{drepSection}</motion.div>
      <motion.div variants={briefingItem}>{voiceSection}</motion.div>
      <motion.div variants={briefingItem}>{treasurySection}</motion.div>
      <motion.div variants={briefingItem}>{upcomingSection}</motion.div>
      <motion.div variants={briefingItem}>{civicIdentityStrip}</motion.div>
    </motion.article>
  );
}
