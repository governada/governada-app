'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { getStoredSession } from '@/lib/supabaseAuth';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface WatchlistIntelligenceProps {
  watchlist: string[];
  currentDrepId?: string | null;
}

interface WatchedDRep {
  id: string;
  name: string | null;
  score: number | null;
  scoreDelta: number | null;
  participationRate: number | null;
  matchScore: number | null;
}

export function WatchlistIntelligence({ watchlist, currentDrepId }: WatchlistIntelligenceProps) {
  const [dreps, setDreps] = useState<WatchedDRep[]>([]);
  const [currentDrepMatch, setCurrentDrepMatch] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const tracked = useRef(false);

  useEffect(() => {
    if (watchlist.length === 0) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    Promise.all([
      supabase.from('dreps').select('id, score, participation_rate, info').in('id', watchlist),

      supabase
        .from('drep_score_history')
        .select('drep_id, score, snapshot_date')
        .in('drep_id', watchlist)
        .lte('snapshot_date', dateStr)
        .order('snapshot_date', { ascending: false }),

      fetchMatches(currentDrepId),
    ]).then(([drepRes, historyRes, matchRes]) => {
      const oldScoreMap: Record<string, number> = {};
      if (historyRes.data) {
        for (const row of historyRes.data) {
          if (!(row.drep_id in oldScoreMap)) {
            oldScoreMap[row.drep_id] = row.score;
          }
        }
      }

      const matchMap: Record<string, number> = {};
      let currentMatch: number | null = null;
      if (matchRes) {
        for (const m of matchRes.matches) {
          matchMap[m.drepId] = m.matchScore;
        }
        if (matchRes.currentDRepMatch) {
          currentMatch = matchRes.currentDRepMatch.matchScore;
        }
      }
      setCurrentDrepMatch(currentMatch);

      const items: WatchedDRep[] = (drepRes.data || []).map((d) => {
        const currentScore = d.score != null ? Number(d.score) : null;
        const oldScore = oldScoreMap[d.id] ?? null;
        return {
          id: d.id,
          name: ((d.info as Record<string, unknown>)?.name as string | null) ?? null,
          score: currentScore,
          scoreDelta:
            currentScore != null && oldScore != null ? Math.round(currentScore - oldScore) : null,
          participationRate: d.participation_rate != null ? Number(d.participation_rate) : null,
          matchScore: matchMap[d.id] ?? null,
        };
      });

      items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setDreps(items);
      setLoading(false);
    });
  }, [watchlist, currentDrepId]);

  useEffect(() => {
    if (!tracked.current && !loading && dreps.length > 0) {
      posthog.capture('watchlist_intelligence_viewed', { count: watchlist.length });
      tracked.current = true;
    }
  }, [loading, dreps.length, watchlist.length]);

  if (watchlist.length === 0) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Watchlist Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Watchlist Intelligence
          <Badge variant="secondary" className="text-xs">
            {dreps.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {dreps.map((d) => (
          <Link
            key={d.id}
            href={`/drep/${d.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{d.name || `${d.id.slice(0, 16)}...`}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {d.participationRate != null && (
                  <span>{Math.round(d.participationRate)}% participation</span>
                )}
                {d.matchScore != null && (
                  <span className="text-primary font-medium">{d.matchScore}% match</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {d.matchScore != null &&
                currentDrepMatch != null &&
                d.id !== currentDrepId &&
                d.matchScore > currentDrepMatch + 15 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Better match
                  </Badge>
                )}

              {d.score != null && (
                <div className="text-right">
                  <span className="text-sm font-semibold tabular-nums">{Math.round(d.score)}</span>
                  {d.scoreDelta != null && d.scoreDelta !== 0 && (
                    <Badge
                      variant="outline"
                      className={`ml-1.5 text-[10px] ${
                        d.scoreDelta > 0
                          ? 'text-green-600 dark:text-green-400 border-green-500/30'
                          : 'text-red-600 dark:text-red-400 border-red-500/30'
                      }`}
                    >
                      {d.scoreDelta > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-0.5" />
                      )}
                      {d.scoreDelta > 0 ? '+' : ''}
                      {d.scoreDelta}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

async function fetchMatches(currentDrepId?: string | null): Promise<{
  matches: { drepId: string; matchScore: number }[];
  currentDRepMatch: { matchScore: number } | null;
} | null> {
  const token = getStoredSession();
  if (!token) return null;

  try {
    const params = new URLSearchParams();
    if (currentDrepId) params.set('currentDrepId', currentDrepId);

    const res = await fetch(`/api/governance/matches?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
