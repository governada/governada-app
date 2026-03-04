'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import { useDashboardDelegatorTrends } from '@/hooks/queries';

const DelegatorTrendChart = dynamic(
  () => import('@/components/DelegatorTrendChart').then((m) => m.DelegatorTrendChart),
  { ssr: false },
);

interface Snapshot {
  epoch: number;
  votingPowerAda: number;
  delegatorCount: number | null;
}

interface DelegatorAnalyticsProps {
  drepId: string;
}

function formatAda(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

export function DelegatorAnalytics({ drepId }: DelegatorAnalyticsProps) {
  const { data: raw, isLoading: loading } = useDashboardDelegatorTrends(drepId);
  const data = raw as { snapshots: Snapshot[]; currentDelegators: number | null } | undefined;

  if (loading) return <DelegatorSkeleton />;
  if (!data) return null;

  const latestPower =
    data.snapshots.length > 0 ? data.snapshots[data.snapshots.length - 1].votingPowerAda : null;

  const firstPower = data.snapshots.length > 1 ? data.snapshots[0].votingPowerAda : null;

  const top10Pct = null; // Will be populated when concentration data is available

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold tabular-nums">
              {data.currentDelegators?.toLocaleString() ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">Current Delegators</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold tabular-nums">
              {latestPower !== null ? `${formatAda(latestPower)} ₳` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Voting Power</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold tabular-nums">
              {top10Pct !== null ? `${top10Pct}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Top 10 Concentration</p>
          </CardContent>
        </Card>
      </div>

      {/* Existing trend chart (voting power over time + delegator count) */}
      <DelegatorTrendChart drepId={drepId} />
    </div>
  );
}

function DelegatorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6 text-center space-y-2">
              <Skeleton className="h-9 w-20 mx-auto" />
              <Skeleton className="h-3 w-24 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-[260px] w-full rounded-lg" />
    </div>
  );
}
