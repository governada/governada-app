'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SyncSummary {
  sync_type: string;
  last_run: string;
  success: boolean;
  duration_ms: number | null;
}

interface OverviewData {
  sync_summary: SyncSummary[];
  total_dreps: number;
  total_proposals: number;
  total_votes: number;
  recent_failures: number;
}

async function fetchOverview(): Promise<OverviewData> {
  const res = await fetch('/api/admin/overview');
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json();
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  trend,
}: {
  title: string;
  value: string | number;
  icon: typeof Activity;
  href: string;
  trend?: 'good' | 'warn' | 'neutral';
}) {
  return (
    <Link href={href}>
      <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </div>
            <Icon
              className={cn(
                'h-8 w-8',
                trend === 'good'
                  ? 'text-emerald-500'
                  : trend === 'warn'
                    ? 'text-amber-500'
                    : 'text-muted-foreground/40',
              )}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SyncStatusRow({ sync, now }: { sync: SyncSummary; now: number }) {
  const age = now - new Date(sync.last_run).getTime();
  const hoursAgo = Math.floor(age / (1000 * 60 * 60));
  const minutesAgo = Math.floor(age / (1000 * 60));
  const timeLabel = hoursAgo > 0 ? `${hoursAgo}h ago` : `${minutesAgo}m ago`;
  const isStale = hoursAgo > 12;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2.5">
        {sync.success ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm font-medium">{sync.sync_type}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {sync.duration_ms && (
          <span className="font-mono">
            {sync.duration_ms > 1000
              ? `${(sync.duration_ms / 1000).toFixed(1)}s`
              : `${sync.duration_ms}ms`}
          </span>
        )}
        <span className={cn('flex items-center gap-1', isStale && 'text-amber-500')}>
          <Clock className="h-3 w-3" />
          {timeLabel}
        </span>
      </div>
    </div>
  );
}

export function AdminOverviewClient() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ops Overview</h1>
        <p className="text-sm text-muted-foreground">System health at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pipeline Health"
          value={data.recent_failures > 0 ? `${data.recent_failures} failures` : 'All clear'}
          icon={Activity}
          href="/admin/pipeline"
          trend={data.recent_failures > 0 ? 'warn' : 'good'}
        />
        <StatCard
          title="DReps Tracked"
          value={data.total_dreps.toLocaleString()}
          icon={TrendingUp}
          href="/admin/governance"
          trend="neutral"
        />
        <StatCard
          title="Proposals"
          value={data.total_proposals.toLocaleString()}
          icon={Database}
          href="/admin/governance"
          trend="neutral"
        />
        <StatCard
          title="Votes Indexed"
          value={data.total_votes.toLocaleString()}
          icon={Database}
          href="/admin/governance"
          trend="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sync Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.sync_summary.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No sync data available</p>
          ) : (
            <div>
              {data.sync_summary.map((sync) => (
                <SyncStatusRow key={sync.sync_type} sync={sync} now={Date.now()} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
