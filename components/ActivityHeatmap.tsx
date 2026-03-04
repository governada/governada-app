'use client';

import { useEffect, useMemo } from 'react';
import { posthog } from '@/lib/posthog';
import { useDRepVotes } from '@/hooks/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity } from 'lucide-react';

interface EpochActivity {
  epoch: number;
  votes: number;
  totalProposals: number;
  withRationale: number;
}

interface ActivityHeatmapProps {
  drepId: string;
}

export function ActivityHeatmap({ drepId }: ActivityHeatmapProps) {
  const { data: rawVotes, isLoading } = useDRepVotes(drepId);

  const data = useMemo(() => {
    const votes = rawVotes as any;
    if (!Array.isArray(votes)) return [];
    const epochMap = new Map<number, { votes: number; withRationale: number }>();
    for (const v of votes) {
      const epoch = v.epochNo || v.epoch_no;
      if (!epoch) continue;
      if (!epochMap.has(epoch)) epochMap.set(epoch, { votes: 0, withRationale: 0 });
      const entry = epochMap.get(epoch)!;
      entry.votes++;
      if (v.hasRationale || v.meta_url) entry.withRationale++;
    }
    return [...epochMap.entries()]
      .map(([epoch, d]) => ({
        epoch,
        votes: d.votes,
        totalProposals: 0,
        withRationale: d.withRationale,
      }))
      .sort((a, b) => a.epoch - b.epoch)
      .slice(-50);
  }, [rawVotes]);

  useEffect(() => {
    if (data.length > 0) {
      posthog.capture('activity_heatmap_viewed', { drepId, epochCount: data.length });
    }
  }, [data.length, drepId]);

  const { minEpoch, maxEpoch, grid } = useMemo(() => {
    if (data.length === 0) return { minEpoch: 0, maxEpoch: 0, grid: [] };
    const min = data[0].epoch;
    const max = data[data.length - 1].epoch;
    const activityMap = new Map(data.map((d) => [d.epoch, d]));

    const cells: (EpochActivity | null)[] = [];
    for (let e = min; e <= max; e++) {
      cells.push(activityMap.get(e) || null);
    }
    return { minEpoch: min, maxEpoch: max, grid: cells };
  }, [data]);

  function getColor(entry: EpochActivity | null): string {
    if (!entry || entry.votes === 0) return 'bg-muted';
    if (entry.votes >= 4) return 'bg-primary';
    if (entry.votes >= 2) return 'bg-primary/70';
    return 'bg-primary/40';
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Voting Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Voting Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No voting activity data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Voting Activity
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">
            Epochs {minEpoch}–{maxEpoch}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex flex-wrap gap-1">
            {grid.map((entry, i) => {
              const epoch = minEpoch + i;
              return (
                <Tooltip key={epoch}>
                  <TooltipTrigger asChild>
                    <div className={`w-3 h-3 rounded-sm ${getColor(entry)} transition-colors`} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      <span className="font-medium">Epoch {epoch}</span>
                      {entry ? (
                        <>
                          : {entry.votes} vote{entry.votes !== 1 ? 's' : ''}, {entry.withRationale}{' '}
                          with rationale
                        </>
                      ) : (
                        <>: No votes</>
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground">Less</span>
          <div className="flex gap-0.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-muted" />
            <div className="w-2.5 h-2.5 rounded-sm bg-primary/40" />
            <div className="w-2.5 h-2.5 rounded-sm bg-primary/70" />
            <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}
