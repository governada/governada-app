'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ArrowUp, ArrowDown, Target } from 'lucide-react';

interface NearbyDRep {
  drepId: string;
  name: string;
  score: number;
  rank: number;
}

interface CompetitiveData {
  rank: number;
  totalActive: number;
  nearbyAbove: NearbyDRep[];
  nearbyBelow: NearbyDRep[];
  distanceToTop10: number;
  top10FocusArea: { pillar: string; gap: number } | null;
}

export function CompetitiveContext({ drepId }: { drepId: string }) {
  const [data, setData] = useState<CompetitiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!drepId) return;
    fetch(`/api/dashboard/competitive?drepId=${encodeURIComponent(drepId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.rank) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [drepId]);

  useEffect(() => {
    if (data) {
      try {
        posthog?.capture('competitive_context_viewed', { drepId, rank: data.rank });
      } catch {}
    }
  }, [data, drepId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Your Ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          Your Ranking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rank display */}
        <div className="text-center py-2">
          <span className="text-3xl font-bold tabular-nums">#{data.rank}</span>
          <span className="text-sm text-muted-foreground ml-1">
            of {data.totalActive} active DReps
          </span>
        </div>

        {/* Nearby DReps */}
        <div className="space-y-1">
          {data.nearbyAbove.map((d) => (
            <Link
              key={d.drepId}
              href={`/drep/${encodeURIComponent(d.drepId)}`}
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
              onClick={() => {
                try {
                  posthog?.capture('nearby_drep_clicked', { drepId: d.drepId });
                } catch {}
              }}
            >
              <div className="flex items-center gap-2">
                <ArrowUp className="h-3 w-3 text-green-500" />
                <span className="text-muted-foreground">#{d.rank}</span>
                <span className="font-medium truncate max-w-[120px]">{d.name}</span>
              </div>
              <span className="tabular-nums font-medium">{d.score}</span>
            </Link>
          ))}

          <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-primary" />
              <span className="font-semibold">You</span>
            </div>
          </div>

          {data.nearbyBelow.map((d) => (
            <Link
              key={d.drepId}
              href={`/drep/${encodeURIComponent(d.drepId)}`}
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
              onClick={() => {
                try {
                  posthog?.capture('nearby_drep_clicked', { drepId: d.drepId });
                } catch {}
              }}
            >
              <div className="flex items-center gap-2">
                <ArrowDown className="h-3 w-3 text-red-500" />
                <span className="text-muted-foreground">#{d.rank}</span>
                <span className="font-medium truncate max-w-[120px]">{d.name}</span>
              </div>
              <span className="tabular-nums font-medium">{d.score}</span>
            </Link>
          ))}
        </div>

        {/* Top 10 path */}
        {data.distanceToTop10 > 0 && data.top10FocusArea && (
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium">{data.distanceToTop10} points from top 10</p>
            <p className="text-[10px] text-muted-foreground">
              Focus on{' '}
              <span className="font-semibold text-foreground">{data.top10FocusArea.pillar}</span> —
              you're {data.top10FocusArea.gap} points below the top-10 average
            </p>
          </div>
        )}

        {data.rank <= 10 && (
          <div className="bg-green-500/10 rounded-lg p-3">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">
              You're in the top 10! Keep it up.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
