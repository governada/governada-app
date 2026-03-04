'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useDashboardRepresentation } from '@/hooks/queries';

interface ProposalAlignment {
  key: string;
  title: string;
  drepVote: string;
  delegatorMajority: string;
  delegatorMajorityPct: number;
  totalResponses: number;
  aligned: boolean;
}

interface RepresentationData {
  alignment: number | null;
  totalCompared: number;
  proposals: ProposalAlignment[];
}

export function RepresentationScorecard({ drepId }: { drepId: string }) {
  const { data: raw, isLoading: loading } = useDashboardRepresentation(drepId);
  const data = raw as RepresentationData | undefined;

  useEffect(() => {
    if (data?.alignment !== null && data?.alignment !== undefined) {
      try {
        posthog?.capture('representation_scorecard_viewed', { drepId, alignment: data.alignment });
      } catch {}
    }
  }, [data, drepId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Delegator Representation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.alignment === null) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Delegator Representation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Not enough delegator poll data yet. As your delegators vote in sentiment polls,
            representation alignment will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const color =
    data.alignment >= 75
      ? 'text-green-600 dark:text-green-400'
      : data.alignment >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Delegator Representation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-1">
          <span className={`text-3xl font-bold tabular-nums ${color}`}>{data.alignment}%</span>
          <p className="text-xs text-muted-foreground mt-1">
            aligned with your delegators on {data.totalCompared} proposal
            {data.totalCompared !== 1 ? 's' : ''}
          </p>
        </div>

        {data.proposals.length > 0 && (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {data.proposals.slice(0, 8).map((p) => (
              <div
                key={p.key}
                className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50"
                onClick={() => {
                  try {
                    posthog?.capture('representation_divergence_clicked', {
                      drepId,
                      proposal: p.key,
                    });
                  } catch {}
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {p.aligned ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <span className="truncate">{p.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    You: {p.drepVote}
                  </Badge>
                  <Badge variant={p.aligned ? 'secondary' : 'destructive'} className="text-[10px]">
                    {p.delegatorMajorityPct}% {p.delegatorMajority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.proposals.filter((p) => !p.aligned && p.delegatorMajorityPct >= 60).length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              {data.proposals.filter((p) => !p.aligned && p.delegatorMajorityPct >= 60).length} vote
              {data.proposals.filter((p) => !p.aligned && p.delegatorMajorityPct >= 60).length !== 1
                ? 's'
                : ''}{' '}
              diverged significantly from delegator sentiment. Consider explaining your reasoning.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
