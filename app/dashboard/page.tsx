'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  ExternalLink,
  Wallet,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  UserRound,
  BarChart3,
  Search,
  ChevronsUpDown,
  Inbox,
  Server,
} from 'lucide-react';
const ScoreHistoryChart = dynamic(() => import('@/components/ScoreHistoryChart').then(m => m.ScoreHistoryChart), { ssr: false, loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> });
import { DRepDashboard } from '@/components/DRepDashboard';
import { GovernanceInboxWidget } from '@/components/GovernanceInboxWidget';
import dynamic from 'next/dynamic';

import { CompetitiveContext } from '@/components/CompetitiveContext';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { RepresentationScorecard } from '@/components/RepresentationScorecard';
import { ScoreSimulator } from '@/components/ScoreSimulator';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
const MilestoneBadges = dynamic(() => import('@/components/MilestoneBadges').then(m => m.MilestoneBadges), { ssr: false, loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> });
import { GovernancePhilosophyEditor } from '@/components/GovernancePhilosophyEditor';
import { BadgeEmbed } from '@/components/BadgeEmbed';
import { WrappedShareCard } from '@/components/WrappedShareCard';
import { ScoreChangeMoment } from '@/components/ScoreChangeMoment';
import { DashboardUrgentBar } from '@/components/DashboardUrgentBar';
const MilestoneCelebrationManager = dynamic(
  () => import('@/components/MilestoneCelebration').then((m) => m.MilestoneCelebrationManager),
  { ssr: false },
);
import { DRepQuestionsInbox } from '@/components/DRepQuestionsInbox';
import { DelegatorAnalytics } from '@/components/DelegatorAnalytics';
import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { applyRationaleCurve, getMissingProfileFields } from '@/utils/scoring';
import { generateDashboardNarrative } from '@/lib/narratives';
import { NarrativeSummary } from '@/components/NarrativeSummary';

import { PageViewTracker } from '@/components/PageViewTracker';
import type { ScoreSnapshot } from '@/lib/data';
import type { VoteRecord } from '@/types/drep';

interface DashboardDRep {
  drepId: string;
  drepHash: string;
  handle: string | null;
  name: string | null;
  ticker: string | null;
  description: string | null;
  votingPower: number;
  votingPowerLovelace: string;
  delegatorCount: number;
  sizeTier: string;
  drepScore: number;
  isActive: boolean;
  participationRate: number;
  rationaleRate: number;
  effectiveParticipation: number;
  deliberationModifier: number;
  reliabilityScore: number;
  reliabilityStreak: number;
  reliabilityRecency: number;
  reliabilityLongestGap: number;
  reliabilityTenure: number;
  profileCompleteness: number;
  anchorUrl: string | null;
  metadata: Record<string, unknown> | null;
  votes: VoteRecord[];
  brokenLinks: string[];
  updatedAt: string | null;
}

interface DashboardData {
  drep: DashboardDRep;
  scoreHistory: ScoreSnapshot[];
  percentile: number;
}

type PageState = 'loading' | 'no-wallet' | 'not-drep' | 'ready' | 'error';

function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return null;
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DRepListItem {
  drepId: string;
  name: string | null;
  drepScore: number;
}

export default function MyDRepPage() {
  const {
    connected,
    isAuthenticated,
    reconnecting,
    ownDRepId,
    sessionAddress,
    address,
    connecting,
  } = useWallet();
  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedDRepId, setSelectedDRepId] = useState<string | null>(null);
  const [drepList, setDrepList] = useState<DRepListItem[]>([]);
  const [inboxPendingCount, setInboxPendingCount] = useState(0);
  const [milestoneData, setMilestoneData] = useState<{
    milestones: { milestoneKey: string; achievedAt: string }[];
    lastVisit: string | null;
  } | null>(null);

  // Check admin status — use sessionAddress if authenticated, fall back to connected address
  const adminCheckAddress = sessionAddress || address;
  useEffect(() => {
    if (!adminCheckAddress) {
      setIsAdmin(false);
      return;
    }
    fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: adminCheckAddress }),
    })
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [adminCheckAddress]);

  // Fetch DRep list for admin switcher
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/dreps')
      .then((r) => r.json())
      .then((d) => {
        const all = (d.allDReps || d.dreps || []) as any[];
        setDrepList(
          all.map((dr: any) => ({
            drepId: dr.drepId,
            name: dr.name,
            drepScore: dr.drepScore ?? 0,
          })),
        );
      })
      .catch(() => {});
  }, [isAdmin]);

  const fetchDashboard = useCallback(async (drepId: string) => {
    setState('loading');
    try {
      const res = await fetch(`/api/dashboard?drepId=${encodeURIComponent(drepId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setState('not-drep');
          return;
        }
        throw new Error('Failed to load dashboard');
      }
      const json = await res.json();
      json.drep.votes = json.drep.votes.map((v: any) => ({
        ...v,
        date: new Date(v.date),
      }));
      setData(json);
      setState('ready');
    } catch (err: any) {
      setError(err.message);
      setState('error');
    }
  }, []);

  // Determine which DRep to load
  const activeDRepId = selectedDRepId || ownDRepId;

  useEffect(() => {
    if (connecting || reconnecting) return;

    if (!isAuthenticated && !isAdmin) {
      setState('no-wallet');
      return;
    }

    // Admin without own DRep can still use the switcher
    if (!activeDRepId && !isAdmin) {
      setState('not-drep');
      return;
    }

    if (activeDRepId) {
      fetchDashboard(activeDRepId);
    } else {
      // Admin with no DRep selected yet — show ready state with no data
      setState('not-drep');
    }
  }, [connected, isAuthenticated, reconnecting, activeDRepId, isAdmin, connecting, fetchDashboard]);

  useEffect(() => {
    if (!activeDRepId) return;
    fetch(`/api/dashboard/inbox?drepId=${encodeURIComponent(activeDRepId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.pendingCount) setInboxPendingCount(d.pendingCount);
      })
      .catch(() => {});
  }, [activeDRepId]);

  useEffect(() => {
    if (!activeDRepId || !sessionAddress) return;
    Promise.all([
      fetch(`/api/dreps/${encodeURIComponent(activeDRepId)}/milestones`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/users/last-visit?wallet=${encodeURIComponent(sessionAddress)}`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([ms, lv]) => {
        setMilestoneData({
          milestones: ms?.milestones || [],
          lastVisit: lv?.lastVisit || null,
        });
      })
      .catch(() => {});
  }, [activeDRepId, sessionAddress]);

  const handleDRepSelect = (drepId: string) => {
    setSelectedDRepId(drepId);
  };

  if (state === 'loading' || connecting || reconnecting) return <DashboardSkeleton />;
  if (state === 'no-wallet') return <ConnectWalletCTA />;
  if (state === 'not-drep' && !isAdmin) return <NotADRepCTA />;
  if (state === 'error') return <ErrorState message={error} />;

  // Admin with no DRep selected yet — show switcher + inbox link
  if (!data && isAdmin) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <AdminDRepSwitcher
          drepList={drepList}
          selectedDRepId={selectedDRepId}
          onSelect={handleDRepSelect}
        />
        <div className="flex justify-center mb-4">
          <Link href="/dashboard/inbox">
            <Button variant="outline" size="sm" className="gap-2">
              <Inbox className="h-4 w-4" />
              Governance Inbox
            </Button>
          </Link>
        </div>
        <div className="text-center py-12 text-muted-foreground text-sm">
          Select a DRep above to view their dashboard.
        </div>
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const { drep, scoreHistory, percentile } = data;
  const prevSnapshot = scoreHistory.length >= 2 ? scoreHistory[scoreHistory.length - 2] : null;
  const scoreChange = prevSnapshot ? drep.drepScore - prevSnapshot.score : null;
  const adjustedRationale = applyRationaleCurve(drep.rationaleRate);
  const brokenUris = new Set<string>(drep.brokenLinks);
  const missingFields = getMissingProfileFields(drep.metadata, brokenUris);
  const profileHealthy = missingFields.length === 0 && drep.brokenLinks.length === 0;
  const lastSynced = formatRelativeTime(drep.updatedAt);

  const isViewingOther = isAdmin && selectedDRepId && selectedDRepId !== ownDRepId;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <PageViewTracker event="dashboard_page_viewed" />
      {/* Admin DRep Switcher */}
      {isAdmin && (
        <AdminDRepSwitcher
          drepList={drepList}
          selectedDRepId={activeDRepId}
          onSelect={handleDRepSelect}
        />
      )}

      {/* Executive Summary Hero */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            {isViewingOther ? 'DRep Dashboard' : 'My Dashboard'}
          </h1>
          {isViewingOther && (
            <Badge
              variant="outline"
              className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
            >
              Admin View
            </Badge>
          )}
        </div>

        <NarrativeSummary
          text={generateDashboardNarrative({
            pendingCount: inboxPendingCount,
            drepScore: drep.drepScore,
            scoreChange,
            percentile,
            delegatorCount: drep.delegatorCount,
            drepName: drep.name || drep.drepId.slice(0, 16),
          })}
          className="mb-3"
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold tabular-nums">{drep.drepScore}</span>
            {scoreChange !== null && (
              <span
                className={`flex items-center gap-0.5 text-sm font-medium ${
                  scoreChange > 0
                    ? 'text-green-600 dark:text-green-400'
                    : scoreChange < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                }`}
              >
                {scoreChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : scoreChange < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {scoreChange > 0 ? '+' : ''}
                {scoreChange}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Top{' '}
            <span className="font-semibold text-foreground">
              {Math.max(1, Math.round(100 - percentile))}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">
              {drep.delegatorCount.toLocaleString()}
            </span>{' '}
            delegators
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{inboxPendingCount}</span> pending
          </div>
          {drep.isActive && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
              Active
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/dashboard/spo"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Server className="h-3 w-3" /> SPO Dashboard
            </Link>
            <Link
              href={`/drep/${encodeURIComponent(drep.drepId)}`}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Public Profile <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Onboarding Checklist */}
      {sessionAddress && (
        <div className="mb-4">
          <OnboardingChecklist
            drepId={drep.drepId}
            walletAddress={sessionAddress}
            profileCompleteness={drep.profileCompleteness}
          />
        </div>
      )}

      {/* Score Change Moment */}
      <ScoreChangeMoment
        drepId={drep.drepId}
        drepName={drep.name || drep.drepId.slice(0, 20)}
        currentScore={drep.drepScore}
      />

      {/* Urgent Actions Bar */}
      <div className="mb-4">
        <DashboardUrgentBar drepId={drep.drepId} />
      </div>

      {/* Milestone Celebrations */}
      {milestoneData && (
        <MilestoneCelebrationManager
          drepId={drep.drepId}
          drepName={drep.name || drep.drepId.slice(0, 20)}
          achievedMilestones={milestoneData.milestones}
          lastVisit={milestoneData.lastVisit}
        />
      )}

      {/* Three-Tab Layout */}
      <DashboardTabs
        drep={drep}
        scoreHistory={scoreHistory}
        adjustedRationale={adjustedRationale}
        inboxPendingCount={inboxPendingCount}
        profileHealthy={profileHealthy}
        missingFields={missingFields}
      />
    </div>
  );
}

function DashboardTabs({
  drep,
  scoreHistory,
  adjustedRationale,
  inboxPendingCount,
  profileHealthy,
  missingFields,
}: {
  drep: DashboardDRep;
  scoreHistory: ScoreSnapshot[];
  adjustedRationale: number;
  inboxPendingCount: number;
  profileHealthy: boolean;
  missingFields: string[];
}) {
  const tabs: TabDefinition[] = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      content: (
        <div className="space-y-6">
          <GovernanceInboxWidget drepId={drep.drepId} />
          <DRepQuestionsInbox drepId={drep.drepId} />
          <DRepDashboard drep={drep} scoreHistory={scoreHistory} />
          <ScoreSimulator drepId={drep.drepId} pendingCount={inboxPendingCount} />
        </div>
      ),
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: BarChart3,
      content: (
        <div className="space-y-6">
          <ScoreHistoryChart history={scoreHistory} />
          <CompetitiveContext drepId={drep.drepId} />
          <RepresentationScorecard drepId={drep.drepId} />
          <ActivityHeatmap drepId={drep.drepId} />
          <MilestoneBadges drepId={drep.drepId} />
        </div>
      ),
    },
    {
      id: 'delegators',
      label: 'Delegators',
      icon: UserRound,
      content: <DelegatorAnalytics drepId={drep.drepId} />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: Users,
      content: (
        <div className="space-y-6">
          <GovernancePhilosophyEditor drepId={drep.drepId} />
          <WrappedShareCard
            variant="drep"
            drepId={drep.drepId}
            drepName={drep.name || drep.drepId.slice(0, 20)}
            score={drep.drepScore}
            participation={drep.effectiveParticipation}
            rationale={adjustedRationale}
            reliability={drep.reliabilityScore}
            rank={null}
            delegators={drep.delegatorCount}
          />
          <BadgeEmbed drepId={drep.drepId} drepName={drep.name || drep.drepId.slice(0, 20)} />
          <ProfileHealthCard
            profileHealthy={profileHealthy}
            missingFields={missingFields}
            brokenLinks={drep.brokenLinks}
          />
        </div>
      ),
    },
  ];

  return <AnimatedTabs tabs={tabs} defaultTab="inbox" stickyOffset={64} />;
}

function ProfileHealthCard({
  profileHealthy,
  missingFields,
  brokenLinks,
}: {
  profileHealthy: boolean;
  missingFields: string[];
  brokenLinks: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {profileHealthy ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          Profile Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {profileHealthy ? (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
            All profile fields complete and links verified
          </p>
        ) : (
          <>
            {missingFields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                  Missing fields ({missingFields.length})
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {missingFields.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <XCircle className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="capitalize">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {brokenLinks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                  Broken links ({brokenLinks.length})
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {brokenLinks.map((link) => (
                    <li key={link} className="flex items-center gap-1.5 truncate">
                      <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                      <span className="truncate">{link}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground pt-1 border-t">
              Update your profile via{' '}
              <a
                href="https://gov.tools"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                gov.tools
              </a>{' '}
              or your wallet&apos;s governance section.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <Skeleton className="h-8 w-64 mb-2" />
      <Skeleton className="h-4 w-96 mb-8" />
      <Skeleton className="h-40 w-full mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[250px] w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[180px] w-full" />
        </div>
      </div>
    </div>
  );
}

function ConnectWalletCTA() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8 space-y-4">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-bold">Enter Governance</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Connect your Cardano wallet to access your personalized governance command center.
          </p>
          <p className="text-xs text-muted-foreground">
            Use the wallet button in the header to connect.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NotADRepCTA() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8 space-y-4">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-bold">No DRep Profile Found</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No DRep profile linked to this wallet yet. If you&apos;ve recently registered, it may
            take up to 30 minutes to sync.
          </p>
          <Link href="/">
            <Button variant="outline" className="gap-2 mt-2">
              Explore DReps <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <Card className="border-2 border-destructive/30">
        <CardContent className="pt-8 pb-8 space-y-4">
          <h2 className="text-xl font-bold">Something went sideways</h2>
          <p className="text-sm text-muted-foreground">
            {message || 'The chain threw us a curveball. Try refreshing.'}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDRepSwitcher({
  drepList,
  selectedDRepId,
  onSelect,
}: {
  drepList: DRepListItem[];
  selectedDRepId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return drepList.slice(0, 50);
    const q = query.toLowerCase();
    return drepList
      .filter((d) => d.name?.toLowerCase().includes(q) || d.drepId.toLowerCase().includes(q))
      .slice(0, 50);
  }, [drepList, query]);

  const selectedName = drepList.find((d) => d.drepId === selectedDRepId)?.name;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="mb-6" ref={dropdownRef}>
      <div className="flex items-center gap-2 mb-2">
        <Badge
          variant="outline"
          className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        >
          Admin
        </Badge>
        <span className="text-xs text-muted-foreground">View any DRep&apos;s dashboard</span>
      </div>
      <div className="relative max-w-md">
        <Button
          variant="outline"
          className="w-full justify-between text-sm"
          onClick={() => setOpen(!open)}
        >
          <span className="truncate">
            {selectedDRepId ? selectedName || selectedDRepId.slice(0, 20) + '…' : 'Select a DRep…'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or DRep ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No DReps match your search. Try a different name or ID.
                </p>
              ) : (
                filtered.map((d) => (
                  <button
                    key={d.drepId}
                    className={`w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors flex items-center justify-between gap-2 ${
                      d.drepId === selectedDRepId ? 'bg-accent' : ''
                    }`}
                    onClick={() => {
                      onSelect(d.drepId);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="truncate">{d.name || d.drepId.slice(0, 24) + '…'}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {d.drepScore}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
