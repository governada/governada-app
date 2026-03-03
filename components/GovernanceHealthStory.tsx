'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  Wallet,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Vote,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Clock,
} from 'lucide-react';
import {
  DelegationHealthCard,
  RedelegationNudge,
  VoteBadge,
  type DashboardData,
} from '@/components/governance-cards';
import { PoolGovernanceCard } from '@/components/PoolGovernanceCard';
import { GovernanceCalendar } from '@/components/GovernanceCalendar';
import { GovernanceBriefCard } from '@/components/GovernanceBriefCard';
import { GovernanceCitizenPanels } from '@/components/GovernanceCitizenPanels';
import { GovernanceLevelBadge } from '@/components/GovernanceLevelBadge';
import { GovernanceFootprintCard } from '@/components/GovernanceFootprintCard';
import { ForYouProposals } from '@/components/ForYouProposals';
import { DelegatorShareCard } from '@/components/DelegatorShareCard';
import { EpochReviewCard } from '@/components/EpochReviewCard';

import { posthog } from '@/lib/posthog';
import type { GovernanceLevel } from '@/lib/governanceLevels';

type HealthStatus = 'green' | 'yellow' | 'red';

function getHealthStatus(delegationHealth: DashboardData['delegationHealth']): HealthStatus {
  if (!delegationHealth) return 'red';
  if (delegationHealth.participationRate < 50) return 'yellow';
  if (delegationHealth.drepScore < 40) return 'yellow';
  return 'green';
}

const HEALTH_CONFIG: Record<
  HealthStatus,
  { label: string; description: string; color: string; bg: string; ring: string }
> = {
  green: {
    label: 'Healthy',
    description: 'Your governance is in good shape',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500',
    ring: 'ring-green-500/30',
  },
  yellow: {
    label: 'Needs Attention',
    description: 'Some aspects of your governance could improve',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500',
    ring: 'ring-amber-500/30',
  },
  red: {
    label: 'Action Required',
    description: 'You need to delegate to participate in governance',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500',
    ring: 'ring-red-500/30',
  },
};

interface ExtendedDashboardData extends DashboardData {
  governanceLevel?: GovernanceLevel;
  pollCount?: number;
  visitStreak?: number;
}

export function GovernanceHealthStory({
  showCalendar,
  showCitizenPanels,
}: {
  showCalendar: boolean;
  showCitizenPanels: boolean;
}) {
  const { connected, isAuthenticated, reconnecting, delegatedDrepId, address } = useWallet();
  const [data, setData] = useState<ExtendedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reconnecting) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const token = getStoredSession();
    if (!token) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (delegatedDrepId) params.set('drepId', delegatedDrepId);

    fetch(`/api/governance/holder?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((json) => {
        setData(json);
        posthog.capture('governance_health_check_viewed', {
          has_delegation: !!json.delegationHealth,
          health_status: getHealthStatus(json.delegationHealth),
        });
      })
      .catch(() => setError('Could not load your governance dashboard.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, delegatedDrepId, reconnecting]);

  if (reconnecting || (loading && isAuthenticated)) return <HealthCheckSkeleton />;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Wallet className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Connect and sign in with your Cardano wallet to see your governance health check.
        </p>
        <Button
          onClick={() => window.dispatchEvent(new Event('openWalletConnect'))}
          className="gap-2"
        >
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (loading) return <HealthCheckSkeleton />;
  if (error) return <p className="text-destructive text-center py-12">{error}</p>;
  if (!data) return null;

  const healthStatus = getHealthStatus(data.delegationHealth);

  return (
    <div className="space-y-8">
      {/* VP1 — Governance Health Check (above fold) */}
      <HealthCheckSection
        data={data}
        healthStatus={healthStatus}
        showCitizenPanels={showCitizenPanels}
      />

      {/* VP2 — Your Governance Story (below fold) */}
      <GovernanceStorySection
        data={data}
        showCalendar={showCalendar}
        stakeAddress={address ?? undefined}
      />
    </div>
  );
}

function HealthCheckSection({
  data,
  healthStatus,
  showCitizenPanels,
}: {
  data: ExtendedDashboardData;
  healthStatus: HealthStatus;
  showCitizenPanels: boolean;
}) {
  const config = HEALTH_CONFIG[healthStatus];
  const actionItems = useActionItems(data, healthStatus);

  return (
    <div className="space-y-6">
      {/* Health status header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full ${config.bg} ring-4 ${config.ring} flex items-center justify-center shrink-0`}
          >
            {healthStatus === 'green' && <CheckCircle2 className="h-6 w-6 text-white" />}
            {healthStatus === 'yellow' && <AlertTriangle className="h-6 w-6 text-white" />}
            {healthStatus === 'red' && <XCircle className="h-6 w-6 text-white" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Governance</h1>
            <p className={`text-sm font-medium ${config.color}`}>{config.description}</p>
          </div>
        </div>
        {data.governanceLevel && (
          <GovernanceLevelBadge
            level={data.governanceLevel}
            pollCount={data.pollCount ?? 0}
            visitStreak={data.visitStreak ?? 0}
            isDelegated={!!data.delegationHealth}
            compact
          />
        )}
      </div>

      {/* Cards grid: DRep + Pool */}
      <div className="grid gap-6 md:grid-cols-2">
        <DelegationHealthCard health={data.delegationHealth} scoreDelta={data.repScoreDelta} />
        <PoolGovernanceCard walletAddress={undefined} />
      </div>

      {/* Action items */}
      {actionItems.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      item.severity === 'high'
                        ? 'bg-red-500'
                        : item.severity === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {item.text}
                    {item.href && (
                      <Link href={item.href} className="text-primary hover:underline ml-1">
                        {item.linkText} &rarr;
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Citizen panels (watchlist, communication feed) */}
      {showCitizenPanels && <GovernanceCitizenPanels />}
    </div>
  );
}

interface ActionItem {
  text: string;
  severity: 'high' | 'medium' | 'low';
  href?: string;
  linkText?: string;
}

function useActionItems(data: ExtendedDashboardData, healthStatus: HealthStatus): ActionItem[] {
  return useMemo(() => {
    const items: ActionItem[] = [];

    if (!data.delegationHealth) {
      items.push({
        text: "You haven't delegated to a DRep yet.",
        severity: 'high',
        href: '/discover',
        linkText: 'Find a DRep',
      });
      return items;
    }

    const unvotedOpen = data.activeProposals.filter((p) => !p.userVote).length;
    if (unvotedOpen > 0) {
      items.push({
        text: `${unvotedOpen} open proposal${unvotedOpen > 1 ? 's' : ''} need your vote.`,
        severity: 'medium',
        href: '/proposals',
        linkText: 'Vote now',
      });
    }

    const drepUnvoted = data.delegationHealth.openProposalCount - data.delegationHealth.votedOnOpen;
    if (drepUnvoted > 0) {
      items.push({
        text: `Your DRep hasn't voted on ${drepUnvoted} open proposal${drepUnvoted > 1 ? 's' : ''}.`,
        severity: 'medium',
      });
    }

    if (
      data.representationScore.score !== null &&
      data.representationScore.score < 50 &&
      data.redelegationSuggestions.length > 0
    ) {
      items.push({
        text: `Your representation match is ${data.representationScore.score}%. Better matches found.`,
        severity: 'medium',
        href: '#redelegation',
        linkText: 'See alternatives',
      });
    }

    if (data.delegationHealth.participationRate < 50) {
      items.push({
        text: `Your DRep's participation rate is only ${data.delegationHealth.participationRate}%.`,
        severity: 'low',
        href: `/drep/${encodeURIComponent(data.delegationHealth.drepId)}`,
        linkText: 'View profile',
      });
    }

    return items;
  }, [data, healthStatus]);
}

function GovernanceStorySection({
  data,
  showCalendar,
  stakeAddress,
}: {
  data: ExtendedDashboardData;
  showCalendar: boolean;
  stakeAddress: string | undefined;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold tracking-tight border-b pb-2">Your Governance Story</h2>

      {stakeAddress && <GovernanceFootprintCard stakeAddress={stakeAddress} />}

      <EpochReviewCard />

      <ForYouProposals />

      {/* DRep Voted Feed */}
      {data.delegationHealth && data.pollHistory.length > 0 && (
        <DRepVotedFeed
          votes={data.pollHistory}
          drepName={data.delegationHealth.drepName}
          drepId={data.delegationHealth.drepId}
        />
      )}

      {/* Pool Voted Feed — placeholder */}
      <Card className="border-cyan-500/20 border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            Your Pool Voted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            SPO governance votes will appear here once pool tracking is available.
          </p>
        </CardContent>
      </Card>

      {/* Governance Calendar */}
      {showCalendar && <GovernanceCalendar />}

      {/* Epoch Brief */}
      <GovernanceBriefCard />

      {/* Redelegation Intelligence */}
      {data.redelegationSuggestions.length > 0 &&
        data.representationScore.score !== null &&
        data.representationScore.score < 50 && (
          <div id="redelegation">
            <RedelegationNudge
              repScore={data.representationScore.score}
              misaligned={data.representationScore.misaligned}
              total={data.representationScore.total}
              suggestions={data.redelegationSuggestions}
            />
          </div>
        )}

      {/* Delegator Share Card */}
      <DelegatorShareCard />
    </div>
  );
}

function DRepVotedFeed({
  votes,
  drepName,
  drepId,
}: {
  votes: DashboardData['pollHistory'];
  drepName: string | null;
  drepId: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const drepVotes = useMemo(() => votes.filter((v) => v.drepVote), [votes]);

  const visible = showAll ? drepVotes : drepVotes.slice(0, 6);

  if (drepVotes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Your DRep Voted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No DRep votes to display yet. Your DRep&apos;s votes will appear here as they
            participate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Your DRep Voted
          </CardTitle>
          <Link
            href={`/drep/${encodeURIComponent(drepId)}`}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {drepName || drepId.slice(0, 12) + '…'}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {visible.map((v) => (
          <Link
            key={`${v.proposalTxHash}-${v.proposalIndex}`}
            href={`/proposals/${v.proposalTxHash}/${v.proposalIndex}`}
            className={`flex items-center gap-2 text-xs rounded px-2 py-2 -mx-2 transition-colors ${
              v.alignedWithDrep === false
                ? 'bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="truncate font-medium">
                {v.proposalTitle || `${v.proposalTxHash.slice(0, 12)}…`}
              </span>
              {v.alignedWithDrep !== null && (
                <span
                  className={`text-[10px] ${
                    v.alignedWithDrep
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {v.alignedWithDrep ? 'Matches your values' : 'Diverges from your vote'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {v.drepVote && <VoteBadge vote={v.drepVote} label="DRep" />}
              {v.alignedWithDrep !== null && (
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1 py-0 ${
                    v.alignedWithDrep
                      ? 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                      : 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-400'
                  }`}
                >
                  {v.alignedWithDrep ? (
                    <>
                      <CheckCircle2 className="h-2 w-2 mr-0.5" />
                      Aligned
                    </>
                  ) : (
                    <>
                      <XCircle className="h-2 w-2 mr-0.5" />
                      Misaligned
                    </>
                  )}
                </Badge>
              )}
            </div>
          </Link>
        ))}

        {drepVotes.length > 6 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-primary hover:underline pt-1"
          >
            {showAll ? 'Show recent' : `Show all ${drepVotes.length} votes`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function HealthCheckSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-64" />
    </div>
  );
}
