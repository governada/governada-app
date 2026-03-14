'use client';

import { useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { useGovernancePulse } from '@/hooks/queries';
import { useTreasuryCurrent } from '@/hooks/queries';
import { useGovernanceLeaderboard } from '@/hooks/queries';
import { CivicaEpochReport } from './CivicaEpochReport';
import { CivicaGovernanceTrends } from './CivicaGovernanceTrends';
import { CivicaObservatory } from './CivicaObservatory';
import { CivicaGovernanceCalendar } from './CivicaGovernanceCalendar';
import { GHIHero } from './GHIHero';
import { GHIExplorer } from './GHIExplorer';
import { GovernanceImpactCard } from './GovernanceImpactCard';
import { GovernanceBriefing } from './GovernanceBriefing';
import { GovernanceAlerts } from './GovernanceAlerts';
import { ActivityTicker } from '@/components/ActivityTicker';
import { useGovernanceHealthIndex } from '@/hooks/queries';
import { EmptyState } from './EmptyState';
import { FirstVisitBanner } from '@/components/ui/FirstVisitBanner';
import { AnonymousNudge } from '@/components/civica/shared/AnonymousNudge';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useDepthConfig } from '@/hooks/useDepthConfig';
import { DepthGate } from '@/components/providers/DepthGate';
import type {
  TreasuryData,
  LeaderboardData,
  LeaderboardEntry,
  CommunityGapItem,
} from '@/types/api';

interface PulseDataLocal {
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
  communityGap?: CommunityGapItem[];
  spotlightProposal?: {
    txHash: string;
    index: number;
    title: string;
    proposalType?: string;
    voteCoverage?: number;
  };
  [key: string]: unknown;
}

type PulseTab = 'now' | 'history' | 'observatory';

const TABS: { id: PulseTab; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'history', label: 'History' },
  { id: 'observatory', label: 'Observatory' },
];

const VALID_PULSE_TABS = new Set<PulseTab>(TABS.map((t) => t.id));

/* ── Hands-Off: single score + trend arrow ─────────────────────────────────── */
function GHIMinimal() {
  const { data: rawGhi, isLoading } = useGovernanceHealthIndex(1);
  const ghi = rawGhi as
    | {
        current?: { score: number; band: string };
        trend?: { direction: string; delta: number };
      }
    | undefined;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-muted/40 animate-pulse" />
        <div className="space-y-1">
          <div className="h-4 w-32 bg-muted/40 rounded animate-pulse" />
          <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const score = ghi?.current?.score ?? 0;
  const band = ghi?.current?.band ?? 'fair';
  const direction = (ghi?.trend?.direction ?? 'flat') as 'up' | 'down' | 'flat';
  const arrow = direction === 'up' ? '\u2191' : direction === 'down' ? '\u2193' : '\u2192';
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const trendColor =
    direction === 'up'
      ? 'text-emerald-500'
      : direction === 'down'
        ? 'text-rose-500'
        : 'text-muted-foreground';

  const BAND_COLORS: Record<string, string> = {
    strong: 'text-emerald-500',
    good: 'text-green-500',
    fair: 'text-amber-500',
    critical: 'text-rose-500',
  };
  const scoreColor = BAND_COLORS[band] ?? BAND_COLORS.fair;

  return (
    <div
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-1"
      data-discovery="gov-health"
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Governance Health
      </p>
      <div className="flex items-baseline gap-2">
        <span className={cn('text-4xl font-bold tabular-nums', scoreColor)}>
          {Math.round(score)}
        </span>
        <span className={cn('text-lg', trendColor)} aria-label={`Trend: ${direction}`}>
          {arrow}
        </span>
        <TrendIcon className={cn('h-4 w-4', trendColor)} />
      </div>
      <p className="text-xs text-muted-foreground capitalize">{band}</p>
    </div>
  );
}

/* ── Informed: score + 4-dimension breakdown + trend ───────────────────────── */
function GHIInformedView() {
  const { data: rawGhi, isLoading, isError, refetch } = useGovernanceHealthIndex(5);
  const ghi = rawGhi as
    | {
        current: {
          score: number;
          band: string;
          components: { name: string; value: number; weight: number; contribution: number }[];
        };
        trend?: { direction: string; delta: number; streakEpochs: number };
      }
    | undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 flex items-center gap-4">
          <div className="h-[80px] w-[80px] rounded-full bg-muted/40 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-muted/40 rounded animate-pulse" />
            <div className="h-3 w-60 bg-muted/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !ghi?.current) {
    return (
      <ErrorCard message="Governance Health temporarily unavailable." onRetry={() => refetch()} />
    );
  }

  const { score, band, components } = ghi.current;
  const direction = (ghi.trend?.direction ?? 'flat') as 'up' | 'down' | 'flat';
  const delta = ghi.trend?.delta ?? 0;

  const BAND_COLORS: Record<string, { text: string; bg: string }> = {
    strong: { text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    good: { text: 'text-green-500', bg: 'bg-green-500/10' },
    fair: { text: 'text-amber-500', bg: 'bg-amber-500/10' },
    critical: { text: 'text-rose-500', bg: 'bg-rose-500/10' },
  };
  const style = BAND_COLORS[band] ?? BAND_COLORS.fair;
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const trendColor =
    direction === 'up'
      ? 'text-emerald-500'
      : direction === 'down'
        ? 'text-rose-500'
        : 'text-muted-foreground';

  // Show top 4 components
  const topComponents = [...components].sort((a, b) => b.weight - a.weight).slice(0, 4);

  return (
    <div className="space-y-4" data-discovery="gov-health">
      {/* Score + band */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <span className={cn('text-3xl font-bold tabular-nums', style.text)}>
              {Math.round(score)}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Governance Health</h2>
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  style.bg,
                  style.text,
                )}
              >
                {band.charAt(0).toUpperCase() + band.slice(1)}
              </span>
            </div>
            {delta !== 0 && (
              <span
                className={cn('inline-flex items-center gap-0.5 text-xs font-medium', trendColor)}
              >
                <TrendIcon className="h-3 w-3" />
                {delta > 0 ? '+' : ''}
                {Math.round(delta * 10) / 10} this epoch
              </span>
            )}
          </div>
        </div>

        {/* Dimension breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {topComponents.map((comp) => (
            <div key={comp.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate">{comp.name}</span>
                <span className="text-xs font-medium tabular-nums">{Math.round(comp.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    style.bg.replace('/10', '/60'),
                  )}
                  style={{ width: `${Math.min(100, comp.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Legacy tab aliases for backwards compatibility with bookmarked URLs
const TAB_ALIASES: Record<string, PulseTab> = {
  overview: 'now',
  epoch: 'history',
  treasury: 'now',
  trends: 'history',
  calendar: 'history',
};

function resolvePulseTab(param: string | null): PulseTab {
  if (!param) return 'now';
  const lower = param.toLowerCase();
  if (VALID_PULSE_TABS.has(lower as PulseTab)) return lower as PulseTab;
  if (lower in TAB_ALIASES) return TAB_ALIASES[lower];
  return 'now';
}

export function CivicaPulseOverview() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isAtLeast } = useGovernanceDepth();
  const depthConfig = useDepthConfig('governance');

  const activeTab = resolvePulseTab(searchParams.get('tab'));

  const setActiveTab = useCallback(
    (tab: PulseTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'now') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const qs = params.toString();
      // Use history API directly to avoid a full server re-render of the force-dynamic page
      window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`);
    },
    [searchParams, pathname],
  );

  const {
    data: rawPulse,
    isLoading: pulseLoading,
    isError: pulseError,
    refetch: refetchPulse,
  } = useGovernancePulse();
  const pulse = rawPulse as PulseDataLocal | undefined;

  const {
    data: rawTreasury,
    isLoading: treasuryLoading,
    isError: treasuryError,
    refetch: refetchTreasury,
  } = useTreasuryCurrent();
  const treasury = rawTreasury as
    | (TreasuryData & {
        balance?: number;
        trend?: string;
        runwayMonths?: number;
        pendingCount?: number;
      })
    | undefined;

  const { data: rawGhi } = useGovernanceHealthIndex(5);
  const ghiData = rawGhi as
    | {
        current: {
          score: number;
          band: string;
          components: { name: string; value: number; weight: number; contribution: number }[];
        };
        history: {
          epoch: number;
          components:
            | { name: string; value: number; weight: number; contribution: number }[]
            | null;
        }[];
        componentTrends: Record<string, { direction: string; delta: number }>;
        calibration: Record<
          string,
          { floor: number; targetLow: number; targetHigh: number; ceiling: number }
        >;
      }
    | undefined;

  const { data: rawLeaderboard } = useGovernanceLeaderboard();
  const leaderboard = rawLeaderboard as LeaderboardData | undefined;

  const gainers: LeaderboardEntry[] = leaderboard?.weeklyMovers?.gainers?.slice(0, 3) ?? [];
  const losers: LeaderboardEntry[] = leaderboard?.weeklyMovers?.losers?.slice(0, 3) ?? [];

  const loading = pulseLoading || treasuryLoading;
  const hasError = pulseError || treasuryError;

  // ── Hands-Off: single score + arrow ─────────────────────────────────────
  if (!isAtLeast('informed')) {
    return <GHIMinimal />;
  }

  // ── Informed: score + dimension breakdown + briefing & alerts, no tabs ──
  if (!isAtLeast('engaged')) {
    return (
      <div className="space-y-6">
        <GHIInformedView />
        <GovernanceBriefing />
        <GovernanceAlerts
          communityGap={pulse?.communityGap}
          spotlightProposal={pulse?.spotlightProposal}
          gainers={gainers}
          losers={losers}
          criticalProposals={pulse?.criticalProposals}
          loading={loading}
        />
      </div>
    );
  }

  // ── Engaged + Deep: full dashboard (current behavior = Engaged baseline) ─

  return (
    <div className="space-y-6 pt-4" data-discovery="gov-health">
      {hasError && (
        <ErrorCard
          message="Unable to load governance data."
          onRetry={() => {
            refetchPulse();
            refetchTreasury();
          }}
        />
      )}
      <FirstVisitBanner
        pageKey="pulse"
        message="The big picture. How healthy is Cardano governance right now? Track participation, treasury, and trends over time."
      />
      <AnonymousNudge variant="health" />
      {/* ── Tab bar ───────────── */}
      <div
        className="sticky top-14 lg:top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 flex gap-1 border-b border-border/30 -mb-2 overflow-x-auto bg-card/60 backdrop-blur-xl"
        role="tablist"
        aria-label="Pulse view"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`pulse-tabpanel-${tab.id}`}
            className={cn(
              'px-4 py-2 text-sm font-medium shrink-0 border-b-2 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'observatory' && (
        <div role="tabpanel" id="pulse-tabpanel-observatory" aria-label="Observatory">
          <CivicaObservatory />
        </div>
      )}

      {/* ── History tab ───── */}
      {activeTab === 'history' && (
        <div className="space-y-8" role="tabpanel" id="pulse-tabpanel-history" aria-label="History">
          <CivicaEpochReport />
          <CivicaGovernanceTrends />
          <CivicaGovernanceCalendar />
        </div>
      )}

      {/* ── Now tab ──────── */}
      {activeTab === 'now' && (
        <div className="space-y-8" role="tabpanel" id="pulse-tabpanel-now" aria-label="Now">
          {/* 1. GHI Verdict */}
          <GHIHero />

          {/* 2. Personal governance footprint */}
          <GovernanceImpactCard
            totalAdaGovernedLovelace={
              (pulse as PulseDataLocal & { totalAdaGovernedRaw?: number })?.totalAdaGovernedRaw ?? 0
            }
            treasuryBalanceAda={treasury?.balance ?? treasury?.balanceAda ?? 0}
          />

          {/* 3. Narrative briefing + headline metric pills */}
          <GovernanceBriefing />

          {/* 4. Consolidated governance alerts */}
          <GovernanceAlerts
            communityGap={pulse?.communityGap}
            spotlightProposal={pulse?.spotlightProposal}
            gainers={gainers}
            losers={losers}
            criticalProposals={pulse?.criticalProposals}
            loading={loading}
          />

          {/* 5. GHI Explorer (click-to-expand breakdown) */}
          {ghiData?.current && (
            <GHIExplorer
              components={ghiData.current.components}
              componentHistory={ghiData.history}
              calibration={ghiData.calibration}
              componentTrends={ghiData.componentTrends}
              band={ghiData.current.band}
              score={ghiData.current.score}
            />
          )}
          {!ghiData?.current && !loading && (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="Governance Health is being computed"
              description="Check back after the current epoch"
            />
          )}

          {/* 6. Live Activity Ticker */}
          <ActivityTicker variant="inline" />

          {/* 7. Deep: historical overlay placeholder */}
          <DepthGate minDepth="deep">
            {/* TODO: Phase 6+ — Historical health overlay, cross-epoch comparison, health projections */}
            <div className="rounded-xl border border-dashed border-border/40 bg-card/30 p-4 text-center">
              <p className="text-xs text-muted-foreground/60">
                Historical health overlay and epoch comparison coming soon
              </p>
            </div>
          </DepthGate>
        </div>
      )}
    </div>
  );
}
