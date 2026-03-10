'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, AlertTriangle, Star, BarChart3 } from 'lucide-react';
import { CONCERN_LABEL_MAP } from '@/lib/engagement/labels';

interface EngagementSummaryProps {
  txHash: string;
  proposalIndex: number;
}

interface AggregatedSignals {
  sentiment: { support: number; oppose: number; unsure: number; total: number } | null;
  concerns: Record<string, number> | null;
  impact: { total: number; ratings: Record<string, number> } | null;
}

export function EngagementSummary({ txHash, proposalIndex }: EngagementSummaryProps) {
  const entityId = `${txHash}:${proposalIndex}`;

  const { data } = useQuery<AggregatedSignals>({
    queryKey: ['engagement-summary', txHash, proposalIndex],
    queryFn: async () => {
      const res = await fetch(`/api/engagement/summary?entityId=${encodeURIComponent(entityId)}`);
      if (!res.ok) return { sentiment: null, concerns: null, impact: null };
      return res.json();
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  const { sentiment, concerns, impact } = data;
  const hasAny = (sentiment && sentiment.total > 0) || concerns || (impact && impact.total > 0);
  if (!hasAny) return null;

  const totalConcerns = concerns ? Object.values(concerns).reduce((a, b) => a + b, 0) : 0;

  // Find top concern
  const topConcern = concerns ? Object.entries(concerns).sort(([, a], [, b]) => b - a)[0] : null;

  return (
    <Card className="bg-muted/30" aria-label="Community engagement signals summary">
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            Community Signals
          </span>

          {sentiment && sentiment.total > 0 && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Users className="h-3 w-3" />
              {sentiment.total} voted &middot;{' '}
              {Math.round((sentiment.support / sentiment.total) * 100)}% support
            </Badge>
          )}

          {totalConcerns > 0 && topConcern && (
            <Badge
              variant="outline"
              className="gap-1 font-normal text-amber-600 dark:text-amber-400 border-amber-500/30"
            >
              <AlertTriangle className="h-3 w-3" />
              {totalConcerns} concern{totalConcerns !== 1 ? 's' : ''} &middot; Top:{' '}
              {CONCERN_LABEL_MAP[topConcern[0]] ?? topConcern[0]}
            </Badge>
          )}

          {impact && impact.total > 0 && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Star className="h-3 w-3" />
              {impact.total} impact report{impact.total !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
