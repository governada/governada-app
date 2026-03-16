'use client';

/**
 * EngagementAnalytics — proposer-facing engagement metrics for a proposal.
 *
 * Shows total views, unique viewers, avg time spent, section read
 * distribution, and viewer segment breakdown. Only visible to the
 * proposal author (checking if current user matches proposal author).
 */

import { useEffect } from 'react';
import { BarChart3, Eye, Clock, Users, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProposalEngagementAnalytics } from '@/lib/workspace/types';
import { posthog } from '@/lib/posthog';

interface EngagementAnalyticsProps {
  txHash: string;
  proposalIndex: number;
  /** Whether the current user is the proposal author */
  isAuthor: boolean;
}

async function fetchEngagementAnalytics(
  txHash: string,
  index: number,
): Promise<ProposalEngagementAnalytics> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session
  }
  const res = await fetch(
    `/api/workspace/engagement?txHash=${encodeURIComponent(txHash)}&index=${index}`,
    { headers },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function useEngagementAnalytics(txHash: string, index: number, enabled: boolean) {
  return useQuery<ProposalEngagementAnalytics>({
    queryKey: ['proposal-engagement', txHash, index],
    queryFn: () => fetchEngagementAnalytics(txHash, index),
    enabled,
    staleTime: 60_000,
  });
}

export function EngagementAnalytics({ txHash, proposalIndex, isAuthor }: EngagementAnalyticsProps) {
  const { data, isLoading, isError } = useEngagementAnalytics(txHash, proposalIndex, isAuthor);

  useEffect(() => {
    if (isAuthor && data) {
      posthog.capture('engagement_analytics_viewed', {
        txHash,
        proposalIndex,
        totalViews: data.totalViews,
      });
    }
  }, [isAuthor, data, txHash, proposalIndex]);

  // Only show to proposal author
  if (!isAuthor) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Engagement Analytics
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Engagement analytics unavailable</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state — no engagement data yet
  if (data.totalViews === 0) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Engagement Analytics
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            No engagement data yet. Metrics will appear once reviewers start viewing this proposal.
          </p>
        </CardContent>
      </Card>
    );
  }

  const avgTimeFormatted =
    data.avgTimeSpentSec > 60
      ? `${Math.round(data.avgTimeSpentSec / 60)}m ${data.avgTimeSpentSec % 60}s`
      : `${data.avgTimeSpentSec}s`;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          Engagement Analytics
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-blue-400" />
            <div>
              <p className="font-medium text-foreground tabular-nums">{data.totalViews}</p>
              <p className="text-muted-foreground">Views</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-violet-400" />
            <div>
              <p className="font-medium text-foreground tabular-nums">{data.uniqueViewers}</p>
              <p className="text-muted-foreground">Unique</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-amber-400" />
            <div>
              <p className="font-medium text-foreground tabular-nums">{avgTimeFormatted}</p>
              <p className="text-muted-foreground">Avg Time</p>
            </div>
          </div>
        </div>

        {/* Section read distribution */}
        {data.sectionDistribution.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Section Reads
            </p>
            <div className="space-y-1">
              {data.sectionDistribution.map((s) => {
                const maxViews = Math.max(...data.sectionDistribution.map((d) => d.viewCount), 1);
                const pct = (s.viewCount / maxViews) * 100;
                return (
                  <div key={s.section} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16 truncate">
                      {s.section}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-blue-400/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">
                      {s.viewCount}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Viewer segments */}
        {data.viewerSegments.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Viewer Segments
            </p>
            <div className="flex flex-wrap gap-2">
              {data.viewerSegments.map((seg) => (
                <span
                  key={seg.segment}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {seg.segment}
                  <span className="font-medium text-foreground">{seg.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
