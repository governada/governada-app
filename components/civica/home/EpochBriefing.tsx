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
  const { data, isLoading, isError } = useCitizenBriefing(wallet);
  const { data: identity } = useCivicIdentity(wallet);
  const { data: rawTreasury } = useTreasuryCurrent();
  const { data: rawPending } = useTreasuryPending();
  const tracked = useRef(false);
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState(0);
  const [direction, setDirection] = useState(0);

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

  /* ── Shared section content ──────────────────────────────────── */

  const briefingHeader = (
    <header className="pb-5 border-b border-border">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Your Governance Briefing
      </p>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-1">
        Epoch {data.epoch}
      </h1>
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
            .map((h: { type: string; title: string; description: string }, i: number) => (
              <li key={i} className="flex gap-3 min-h-[44px] items-start">
                <span className="text-primary font-bold text-lg leading-none mt-0.5">&bull;</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{h.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>
                </div>
              </li>
            ))}
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

  const treasurySection = (
    <div className="py-5 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Where your money goes
        </p>
        <Link
          href="/pulse"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 min-h-[44px] sm:min-h-0"
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
          {data.treasury.pendingProposals} proposal
          {data.treasury.pendingProposals !== 1 ? 's' : ''} requesting funds
        </p>
      )}
    </div>
  );

  const upcomingSection =
    data.upcoming && data.upcoming.activeProposals > 0 ? (
      <div className="py-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground flex-1 min-w-0">
            <Vote className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{data.upcoming.activeProposals}</span> proposal
              {data.upcoming.activeProposals !== 1 ? 's' : ''} open
            </span>
            {data.upcoming.critical > 0 && (
              <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 shrink-0">
                {data.upcoming.critical} critical
              </Badge>
            )}
          </div>
          <Link
            href="/discover"
            className="shrink-0 text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 min-h-[44px]"
          >
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    ) : null;

  const civicIdentityStrip = identity ? (
    <div className="pt-5 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      {identity.citizenSinceEpoch != null && (
        <span className="inline-flex items-center gap-1.5 min-h-[36px]">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          Citizen since Epoch {identity.citizenSinceEpoch}
        </span>
      )}
      {identity.delegationStreak != null && identity.delegationStreak > 0 && (
        <span className="inline-flex items-center gap-1.5 min-h-[36px]">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          {identity.delegationStreak} epoch streak
        </span>
      )}
      {identity.proposalsInfluenced != null && identity.proposalsInfluenced > 0 && (
        <span className="inline-flex items-center gap-1.5 min-h-[36px]">
          <Vote className="h-3.5 w-3.5" aria-hidden="true" />
          {identity.proposalsInfluenced} proposals influenced
        </span>
      )}
      {identity.adaGoverned != null && (
        <span className="inline-flex items-center gap-1.5 min-h-[36px]">
          <Coins className="h-3.5 w-3.5" aria-hidden="true" />
          {formatAdaCompact(identity.adaGoverned)} ADA governed
        </span>
      )}
    </div>
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
    <article className="space-y-0">
      {briefingHeader}
      {statusBanner}
      {narrativeSection}
      {headlinesSection}
      {drepSection}
      {treasurySection}
      {upcomingSection}
      {civicIdentityStrip}
    </article>
  );
}
