'use client';

import { useEffect, useMemo } from 'react';
import { useWallet } from '@/utils/wallet';
import { useGovernanceHolder } from '@/hooks/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Coins, Flame, TrendingUp } from 'lucide-react';
import { GovernanceLevelBadge } from '@/components/GovernanceLevelBadge';
import type { GovernanceLevel } from '@/lib/governanceLevels';
import { posthog } from '@/lib/posthog';

interface HeroData {
  proposalsShaped: number;
  adaGoverned: number;
  epochStreak: number;
  governanceLevel: GovernanceLevel;
  pollCount: number;
  visitStreak: number;
  isDelegated: boolean;
}

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`;
  return ada.toLocaleString();
}

export function GovernanceImpactHero() {
  const { isAuthenticated, reconnecting, delegatedDrepId, address } = useWallet();
  const stakeAddress = isAuthenticated && !reconnecting ? (address ?? undefined) : undefined;
  const { data: holderData, isLoading } = useGovernanceHolder(stakeAddress);

  const data = useMemo<HeroData | null>(() => {
    const json = holderData as any;
    if (!json) return null;
    const proposalsShaped = json.representationScore?.total ?? 0;
    const votingPower = json.delegationHealth?.votingPowerLovelace ?? 0;
    const adaGoverned = proposalsShaped > 0 ? votingPower * proposalsShaped : 0;
    return {
      proposalsShaped,
      adaGoverned,
      epochStreak: json.visitStreak ?? 0,
      governanceLevel: json.governanceLevel ?? 'observer',
      pollCount: json.pollCount ?? 0,
      visitStreak: json.visitStreak ?? 0,
      isDelegated: !!json.delegationHealth,
    };
  }, [holderData]);

  useEffect(() => {
    if (data) posthog.capture('governance_impact_hero_viewed');
  }, [data]);

  if (!isAuthenticated || reconnecting) return null;
  if (isLoading) return <HeroSkeleton />;
  if (!data) return null;

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent pointer-events-none" />
      <CardContent className="relative p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Your Governance Impact</h2>
            <p className="text-sm text-muted-foreground">How your participation shapes Cardano</p>
          </div>
          <GovernanceLevelBadge
            level={data.governanceLevel}
            pollCount={data.pollCount}
            visitStreak={data.visitStreak}
            isDelegated={data.isDelegated}
            compact
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatBlock
            icon={<FileText className="h-4 w-4" />}
            value={data.proposalsShaped}
            label="Proposals shaped"
            sub="through your DRep"
          />
          <StatBlock
            icon={<Coins className="h-4 w-4" />}
            value={data.adaGoverned > 0 ? formatAda(data.adaGoverned) : '—'}
            label="ADA in governance"
            sub="decisions influenced"
          />
          <StatBlock
            icon={<Flame className="h-4 w-4" />}
            value={data.epochStreak}
            label="Epoch streak"
            sub="consecutive visits"
            className="col-span-2 md:col-span-1"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatBlock({
  icon,
  value,
  label,
  sub,
  className = '',
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <Card className="border-0 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent">
      <CardContent className="p-6 space-y-5">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-2 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
