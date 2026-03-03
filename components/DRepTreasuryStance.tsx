'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StanceSkeleton } from '@/components/ui/content-skeletons';
import { Landmark, ThumbsUp, ThumbsDown, Scale, Award } from 'lucide-react';
import { formatAda, type DRepTreasuryRecord } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';

interface Props {
  drepId: string;
  compact?: boolean;
}

export function DRepTreasuryStance({ drepId, compact = false }: Props) {
  const [record, setRecord] = useState<DRepTreasuryRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/lib/treasury').then(({ getDRepTreasuryTrackRecord }) => {
      getDRepTreasuryTrackRecord(drepId)
        .then((r) => {
          setRecord(r);
          setLoading(false);
          if (r && r.totalProposals > 0) {
            posthog.capture('drep_treasury_stance_viewed', {
              drep_id: drepId,
              total_proposals: r.totalProposals,
              judgment_score: r.judgmentScore,
            });
          }
        })
        .catch(() => setLoading(false));
    });
  }, [drepId]);

  if (loading) return compact ? null : <StanceSkeleton />;
  if (!record || record.totalProposals === 0) return null;

  const stance =
    record.approvedAda > record.opposedAda * 2
      ? 'Growth'
      : record.opposedAda > record.approvedAda * 2
        ? 'Conservative'
        : 'Balanced';

  const stanceColor =
    stance === 'Growth'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : stance === 'Conservative'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Landmark className="h-3 w-3 text-muted-foreground" />
        <span>Treasury: {record.totalProposals} votes</span>
        <Badge variant="secondary" className={`text-[10px] ${stanceColor}`}>
          {stance}
        </Badge>
        {record.judgmentScore !== null && (
          <span className="text-muted-foreground">{record.judgmentScore}% accuracy</span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          Treasury Track Record
          <Badge variant="secondary" className={`text-xs ${stanceColor}`}>
            {stance}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span className="text-lg font-bold">{record.approvedCount}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Approved ({formatAda(record.approvedAda)})
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-red-500">
              <ThumbsDown className="h-3.5 w-3.5" />
              <span className="text-lg font-bold">{record.opposedCount}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Opposed ({formatAda(record.opposedAda)})
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Scale className="h-3.5 w-3.5" />
              <span className="text-lg font-bold">{record.abstainedCount}</span>
            </div>
            <div className="text-xs text-muted-foreground">Abstained</div>
          </div>
        </div>

        {record.judgmentScore !== null && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Award className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Treasury Judgment Score</div>
              <div className="text-sm font-semibold">
                {record.judgmentScore}% of approved spending delivered
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Voted on {record.totalProposals} treasury proposals totaling{' '}
          {formatAda(record.totalAdaVotedOn)} ADA
        </div>
      </CardContent>
    </Card>
  );
}
