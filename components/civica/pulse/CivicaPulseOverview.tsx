'use client';

import { useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Vote,
  DollarSign,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useGovernancePulse } from '@/hooks/queries';
import { useTreasuryCurrent } from '@/hooks/queries';
import { useGovernanceLeaderboard } from '@/hooks/queries';
import { CivicaEpochReport } from './CivicaEpochReport';
import { CivicaGovernanceTrends } from './CivicaGovernanceTrends';
import { CivicaObservatory } from './CivicaObservatory';
import { CivicaGovernanceCalendar } from './CivicaGovernanceCalendar';
import { StateOfGovernance } from './StateOfGovernance';
import { GovernanceImpactCard } from './GovernanceImpactCard';
import { FirstVisitBanner } from '@/components/ui/FirstVisitBanner';
import type {
  TreasuryData,
  LeaderboardData,
  LeaderboardEntry,
  CommunityGapItem,
  TreasuryHealthComponent,
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

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  accent?: 'default' | 'warning' | 'success' | 'danger';
  href?: string;
}) {
  const accentClass = {
    default: 'text-primary',
    warning: 'text-amber-400',
    success: 'text-emerald-400',
    danger: 'text-rose-400',
  }[accent ?? 'default'];

  const Wrap = href ? Link : 'div';
  return (
    <Wrap
      href={href as string}
      className={cn(
        'rounded-xl border border-border bg-card p-4 space-y-2 transition-colors',
        href &&
          'hover:border-primary/30 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      )}
      {...(href ? { 'aria-label': `${label}: ${value}${sub ? `, ${sub}` : ''}` } : {})}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </p>
        <Icon className={cn('h-4 w-4', accentClass)} aria-hidden="true" />
      </div>
      <div className={cn('font-display text-3xl font-bold leading-none tabular-nums', accentClass)}>
        {value}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {href && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 group-hover:text-primary transition-colors">
          View details <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </Wrap>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-2.5 w-32" />
    </div>
  );
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `₳${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `₳${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `₳${Math.round(ada / 1_000)}K`;
  return `₳${Math.round(ada)}`;
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

  const { data: rawPulse, isLoading: pulseLoading } = useGovernancePulse();
  const pulse = rawPulse as PulseDataLocal | undefined;

  const { data: rawTreasury, isLoading: treasuryLoading } = useTreasuryCurrent();
  const treasury = rawTreasury as
    | (TreasuryData & {
        balance?: number;
        trend?: string;
        runwayMonths?: number;
        pendingCount?: number;
      })
    | undefined;

  const { data: rawLeaderboard } = useGovernanceLeaderboard();
  const leaderboard = rawLeaderboard as LeaderboardData | undefined;

  const gainers: LeaderboardEntry[] = leaderboard?.weeklyMovers?.gainers?.slice(0, 3) ?? [];
  const losers: LeaderboardEntry[] = leaderboard?.weeklyMovers?.losers?.slice(0, 3) ?? [];

  const loading = pulseLoading || treasuryLoading;

  return (
    <div className="space-y-6 pt-4">
      <FirstVisitBanner
        pageKey="pulse"
        message="The big picture. How healthy is Cardano governance right now? Track participation, treasury, and trends over time."
      />
      {/* ── Tab bar ─────────────────────────────────────────── */}
      <div
        className="flex gap-1 border-b border-border -mb-2 overflow-x-auto"
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

      {/* ── History tab: epoch report + trends + calendar ───── */}
      {activeTab === 'history' && (
        <div className="space-y-8" role="tabpanel" id="pulse-tabpanel-history" aria-label="History">
          <CivicaEpochReport />
          <CivicaGovernanceTrends />
          <CivicaGovernanceCalendar />
        </div>
      )}

      {/* ── Now tab ─────────────────────────────────────────── */}
      {activeTab === 'now' && (
        <div role="tabpanel" id="pulse-tabpanel-now" aria-label="Now">
          {/* ── State of Governance narrative ───────────────────── */}
          <StateOfGovernance />

          {/* ── Personalized governance impact card ────────────── */}
          <GovernanceImpactCard
            totalAdaGovernedLovelace={
              (pulse as PulseDataLocal & { totalAdaGovernedRaw?: number })?.totalAdaGovernedRaw ?? 0
            }
            treasuryBalanceAda={treasury?.balance ?? treasury?.balanceAda ?? 0}
          />

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">State of Governance</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {pulse?.currentEpoch
                  ? `Epoch ${pulse.currentEpoch} · live data`
                  : 'Live Cardano governance data'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>

          {/* ── Stats grid ──────────────────────────────────────── */}
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Current Epoch"
                value={pulse?.currentEpoch ?? '—'}
                sub="Cardano consensus layer"
                icon={Activity}
              />
              <StatCard
                label="Active Proposals"
                value={pulse?.activeProposals ?? 0}
                sub={
                  (pulse?.criticalProposals ?? 0) > 0
                    ? `${pulse!.criticalProposals} critical`
                    : 'No critical proposals'
                }
                icon={Vote}
                accent={(pulse?.criticalProposals ?? 0) > 0 ? 'warning' : 'success'}
                href="/discover"
              />
              <StatCard
                label="Active DReps"
                value={pulse?.activeDReps ?? 0}
                sub={pulse?.totalDReps ? `of ${pulse.totalDReps} total` : undefined}
                icon={Users}
                accent="default"
                href="/discover"
              />
              <StatCard
                label="Votes This Week"
                value={pulse?.votesThisWeek?.toLocaleString() ?? 0}
                sub="On-chain DRep votes"
                icon={BarChart3}
                accent={(pulse?.votesThisWeek ?? 0) > 100 ? 'success' : 'default'}
              />
              <StatCard
                label="Avg Participation"
                value={`${pulse?.avgParticipationRate ?? 0}%`}
                sub="Across all DReps"
                icon={Activity}
                accent={
                  ((pulse?.avgParticipationRate as number | undefined) ?? 0) >= 70
                    ? 'success'
                    : ((pulse?.avgParticipationRate as number | undefined) ?? 0) >= 40
                      ? 'warning'
                      : 'danger'
                }
              />
              <StatCard
                label="Avg Rationale Rate"
                value={`${pulse?.avgRationaleRate ?? 0}%`}
                sub="DReps providing rationale"
                icon={BarChart3}
                accent={
                  ((pulse?.avgRationaleRate as number | undefined) ?? 0) >= 60
                    ? 'success'
                    : ((pulse?.avgRationaleRate as number | undefined) ?? 0) >= 30
                      ? 'warning'
                      : 'danger'
                }
              />
              {treasury && (
                <>
                  <StatCard
                    label="Treasury Balance"
                    value={formatAda(treasury.balance ?? treasury.balanceAda ?? 0)}
                    sub={
                      treasury.trend === 'growing'
                        ? '↑ Growing'
                        : treasury.trend === 'shrinking'
                          ? '↓ Shrinking'
                          : 'Stable'
                    }
                    icon={DollarSign}
                    accent={
                      treasury.trend === 'growing'
                        ? 'success'
                        : treasury.trend === 'shrinking'
                          ? 'danger'
                          : 'default'
                    }
                  />
                  <StatCard
                    label="Treasury Runway"
                    value={
                      (treasury.runwayMonths ?? 0) >= 999 ? '∞' : `${treasury.runwayMonths ?? 0}mo`
                    }
                    sub={
                      (treasury.pendingCount ?? 0) > 0
                        ? `${treasury.pendingCount} withdrawal${(treasury.pendingCount ?? 0) > 1 ? 's' : ''} pending`
                        : 'No pending withdrawals'
                    }
                    icon={TrendingUp}
                    accent={(treasury.runwayMonths ?? 0) > 24 ? 'success' : 'warning'}
                  />
                </>
              )}
            </div>
          )}

          {/* ── Spotlight Proposal ──────────────────────────────── */}
          {pulse?.spotlightProposal && (
            <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Spotlight Proposal
                </p>
              </div>
              <Link
                href={`/proposal/${pulse.spotlightProposal.txHash}/${pulse.spotlightProposal.index}`}
                className="block text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {pulse.spotlightProposal.title}
              </Link>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="capitalize">
                  {pulse.spotlightProposal.proposalType?.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                {pulse.spotlightProposal.voteCoverage != null && (
                  <span>
                    <strong className="text-foreground">
                      {pulse.spotlightProposal.voteCoverage}%
                    </strong>{' '}
                    DRep vote coverage
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Weekly movers ───────────────────────────────────── */}
          {(gainers.length > 0 || losers.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {gainers.length > 0 && (
                <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Rising this week
                    </p>
                  </div>
                  <div className="space-y-2">
                    {gainers.map((m) => (
                      <Link
                        key={m.drepId}
                        href={`/drep/${m.drepId}`}
                        className="flex items-center justify-between group"
                      >
                        <span className="text-sm text-foreground/80 truncate max-w-[200px] group-hover:text-foreground transition-colors">
                          {m.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs font-bold text-emerald-400 tabular-nums">
                            +{m.delta}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            → {m.currentScore}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {losers.length > 0 && (
                <div className="rounded-xl border border-rose-900/30 bg-rose-950/10 p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                    <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                      Falling this week
                    </p>
                  </div>
                  <div className="space-y-2">
                    {losers.map((m) => (
                      <Link
                        key={m.drepId}
                        href={`/drep/${m.drepId}`}
                        className="flex items-center justify-between group"
                      >
                        <span className="text-sm text-foreground/80 truncate max-w-[200px] group-hover:text-foreground transition-colors">
                          {m.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs font-bold text-rose-400 tabular-nums">
                            {m.delta}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            → {m.currentScore}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Community vs DRep Sentiment Gap ─────────────────── */}
          {(pulse?.communityGap?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Community vs DRep Sentiment
              </p>
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {(pulse!.communityGap as CommunityGapItem[]).slice(0, 3).map((g) => {
                  const pollTotal = g.pollTotal || 1;
                  const yesPct = Math.round(((g.pollYes ?? 0) / pollTotal) * 100);
                  const noPct = Math.round(((g.pollNo ?? 0) / pollTotal) * 100);
                  return (
                    <Link
                      key={`${g.txHash}-${g.index}`}
                      href={`/proposal/${g.txHash}/${g.index}`}
                      className="block px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <p className="text-sm truncate mb-1.5">{g.title}</p>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-muted-foreground">
                          Community: <strong className="text-emerald-400">{yesPct}% Yes</strong>
                          {' / '}
                          <strong className="text-rose-400">{noPct}% No</strong>
                          <span className="text-muted-foreground/60"> ({pollTotal} votes)</span>
                        </span>
                        <span className="text-muted-foreground">
                          DReps: <strong className="text-foreground">{g.drepVotePct}%</strong> voted
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Treasury Health Components ─────────────────────── */}
          {treasury?.healthComponents &&
            typeof treasury.healthComponents === 'object' &&
            (() => {
              const components = Array.isArray(treasury.healthComponents)
                ? (treasury.healthComponents as TreasuryHealthComponent[])
                : Object.entries(treasury.healthComponents as Record<string, number>).map(
                    ([key, value]) => ({
                      name: key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (s: string) => s.toUpperCase()),
                      score: value,
                    }),
                  );
              if (components.length === 0) return null;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Treasury Health Breakdown
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {components.map((c: TreasuryHealthComponent) => (
                      <div
                        key={c.name ?? c.label}
                        className="rounded-xl border border-border bg-card px-4 py-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium truncate">
                            {c.name ?? c.label}
                          </p>
                          <span
                            className={cn(
                              'text-sm font-bold tabular-nums',
                              (c.score ?? c.value ?? 0) >= 70
                                ? 'text-emerald-400'
                                : (c.score ?? c.value ?? 0) >= 40
                                  ? 'text-amber-400'
                                  : 'text-rose-400',
                            )}
                          >
                            {Math.round(c.score ?? c.value ?? 0)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              (c.score ?? c.value ?? 0) >= 70
                                ? 'bg-emerald-500'
                                : (c.score ?? c.value ?? 0) >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500',
                            )}
                            style={{ width: `${Math.min(100, c.score ?? c.value ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          {/* ── ADA governed ────────────────────────────────────── */}
          {pulse?.totalAdaGoverned && (
            <div className="rounded-xl border border-border bg-muted/10 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Total ADA under DRep governance
                </p>
                <p className="font-display text-2xl font-bold text-foreground mt-0.5">
                  ₳{String(pulse.totalAdaGoverned)}
                </p>
              </div>
              <Link
                href="/discover"
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
              >
                Browse DReps <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
