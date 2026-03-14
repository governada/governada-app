'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Compass } from 'lucide-react';
import type { ProposalVoteDetail } from '@/lib/data';

const DIMENSIONS = [
  { key: 'treasuryConservative', label: 'Treasury Conservative', color: 'bg-red-500' },
  { key: 'treasuryGrowth', label: 'Treasury Growth', color: 'bg-emerald-500' },
  { key: 'decentralization', label: 'Decentralization', color: 'bg-purple-500' },
  { key: 'security', label: 'Security', color: 'bg-blue-500' },
  { key: 'innovation', label: 'Innovation', color: 'bg-cyan-500' },
  { key: 'transparency', label: 'Transparency', color: 'bg-amber-500' },
] as const;

type DimensionKey = (typeof DIMENSIONS)[number]['key'];

interface CohortData {
  dimension: string;
  color: string;
  total: number;
  yes: number;
  no: number;
  abstain: number;
  yesPct: number;
}

interface AlignmentCohortBreakdownProps {
  votes: ProposalVoteDetail[];
}

function getDominantDimension(
  alignments: NonNullable<ProposalVoteDetail['alignments']>,
): DimensionKey | null {
  let maxVal = -1;
  let maxKey: DimensionKey | null = null;

  for (const dim of DIMENSIONS) {
    const val = alignments[dim.key];
    if (val != null && val > maxVal) {
      maxVal = val;
      maxKey = dim.key;
    }
  }

  return maxVal > 0.3 ? maxKey : null;
}

export function AlignmentCohortBreakdown({ votes }: AlignmentCohortBreakdownProps) {
  const cohorts = useMemo(() => {
    const buckets = new Map<DimensionKey, { yes: number; no: number; abstain: number }>();

    for (const dim of DIMENSIONS) {
      buckets.set(dim.key, { yes: 0, no: 0, abstain: 0 });
    }

    let hasAnyAlignment = false;

    for (const v of votes) {
      if (!v.alignments) continue;
      const dominant = getDominantDimension(v.alignments);
      if (!dominant) continue;

      hasAnyAlignment = true;
      const bucket = buckets.get(dominant)!;
      if (v.vote === 'Yes') bucket.yes++;
      else if (v.vote === 'No') bucket.no++;
      else bucket.abstain++;
    }

    if (!hasAnyAlignment) return [];

    const result: CohortData[] = [];
    for (const dim of DIMENSIONS) {
      const bucket = buckets.get(dim.key)!;
      const total = bucket.yes + bucket.no + bucket.abstain;
      if (total < 2) continue; // Skip cohorts with too few voters
      result.push({
        dimension: dim.label,
        color: dim.color,
        total,
        yes: bucket.yes,
        no: bucket.no,
        abstain: bucket.abstain,
        yesPct: Math.round((bucket.yes / total) * 100),
      });
    }

    return result.sort((a, b) => b.total - a.total);
  }, [votes]);

  if (cohorts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Compass className="h-4 w-4" />
          How Alignment Cohorts Voted
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cohorts.map((cohort) => {
          const noPct = Math.round((cohort.no / cohort.total) * 100);
          const abstainPct = 100 - cohort.yesPct - noPct;

          return (
            <div key={cohort.dimension} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className={cn('h-2.5 w-2.5 rounded-full', cohort.color)} />
                  <span className="font-medium">{cohort.dimension}</span>
                  <span className="text-muted-foreground">({cohort.total})</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] tabular-nums">
                  <span className="text-green-500">{cohort.yesPct}% Yes</span>
                  <span className="text-red-500">{noPct}% No</span>
                  {abstainPct > 0 && (
                    <span className="text-muted-foreground">{abstainPct}% Abstain</span>
                  )}
                </div>
              </div>
              {/* Stacked bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                {cohort.yesPct > 0 && (
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${cohort.yesPct}%` }}
                  />
                )}
                {noPct > 0 && (
                  <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${noPct}%` }}
                  />
                )}
                {abstainPct > 0 && (
                  <div
                    className="h-full bg-muted-foreground/30 transition-all duration-500"
                    style={{ width: `${abstainPct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-muted-foreground pt-1">
          DReps grouped by their strongest governance alignment dimension. Minimum 2 voters per
          cohort.
        </p>
      </CardContent>
    </Card>
  );
}
