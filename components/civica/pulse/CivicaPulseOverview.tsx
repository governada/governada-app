'use client';

import { useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { Activity } from 'lucide-react';
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

  return (
    <div className="space-y-6 pt-4">
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
        </div>
      )}
    </div>
  );
}
