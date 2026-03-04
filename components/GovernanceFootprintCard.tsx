'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Footprints, Shield, Vote, Flame, TrendingUp } from 'lucide-react';
import { useGovernanceFootprint } from '@/hooks/queries';

interface GovernanceFootprint {
  identity: {
    balanceAda: number;
    delegatedPool: string | null;
    delegatedDRep: string | null;
    delegationAgeDays: number | null;
    participationTier: 'observer' | 'participant' | 'active' | 'champion';
  };
  delegationRecord: {
    drepName: string | null;
    drepScore: number | null;
    drepRank: number | null;
    keyVotes: number;
    delegationChanges: number;
  };
  citizenActivity: {
    pollsTaken: number;
    pollStreak: number;
    consistency: number | null;
    epochsActive: number;
    lastActivityEpoch: number | null;
  };
  impact: {
    adaGoverned: number;
    proposalsInfluenced: number;
    delegationWeight: 'whale' | 'significant' | 'moderate' | 'light';
  };
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(Math.round(ada));
}

const TIER_STYLES: Record<
  'observer' | 'participant' | 'active' | 'champion',
  { label: string; className: string }
> = {
  observer: { label: 'Observer', className: 'bg-muted text-muted-foreground' },
  participant: {
    label: 'Participant',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  active: {
    label: 'Active',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  champion: {
    label: 'Champion',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
};

const WEIGHT_STYLES: Record<'whale' | 'significant' | 'moderate' | 'light', string> = {
  whale: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  significant: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  moderate: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  light: 'bg-muted text-muted-foreground',
};

export function GovernanceFootprintCard({ stakeAddress }: { stakeAddress: string }) {
  const { data: rawData, isLoading, isError } = useGovernanceFootprint(stakeAddress);
  const data = (rawData as GovernanceFootprint) ?? null;

  if (!stakeAddress) return null;
  if (isError) return null;
  if (isLoading) return <GovernanceFootprintSkeleton />;
  if (!data) return null;

  const tier = TIER_STYLES[data.identity.participationTier];
  const weightClass = WEIGHT_STYLES[data.impact.delegationWeight];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Footprints className="h-4 w-4 text-primary" />
          Your Governance Footprint
        </CardTitle>
        <Badge variant="outline" className={`w-fit ${tier.className}`}>
          {tier.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Delegation
            </h4>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">{data.delegationRecord.drepName ?? '—'}</span>
                {data.delegationRecord.drepScore != null && (
                  <span className="text-muted-foreground ml-1">
                    (score {data.delegationRecord.drepScore}
                    {data.delegationRecord.drepRank != null &&
                      `, rank #${data.delegationRecord.drepRank}`}
                    )
                  </span>
                )}
              </p>
              {data.identity.delegationAgeDays != null && (
                <p className="text-muted-foreground">
                  Delegation age: {data.identity.delegationAgeDays} days
                </p>
              )}
              <p className="text-muted-foreground">
                Changes: {data.delegationRecord.delegationChanges}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5" />
              Activity
            </h4>
            <div className="space-y-1 text-sm">
              <p>Polls taken: {data.citizenActivity.pollsTaken}</p>
              <p className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Streak: {data.citizenActivity.pollStreak}
              </p>
              <p className="text-muted-foreground">
                Epochs active: {data.citizenActivity.epochsActive}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Impact
            </h4>
            <div className="space-y-1 text-sm">
              <p>ADA governed: {formatAda(data.impact.adaGoverned)}</p>
              <p>Proposals influenced: {data.impact.proposalsInfluenced}</p>
              <Badge variant="outline" className={`text-[10px] capitalize ${weightClass}`}>
                {data.impact.delegationWeight}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Consistency</h4>
            <div className="space-y-1 text-sm">
              {data.citizenActivity.consistency != null ? (
                <p>Score: {data.citizenActivity.consistency}%</p>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
              {data.citizenActivity.lastActivityEpoch != null ? (
                <p className="text-muted-foreground">
                  Last activity: epoch {data.citizenActivity.lastActivityEpoch}
                </p>
              ) : (
                <p className="text-muted-foreground">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GovernanceFootprintSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
