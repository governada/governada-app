'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Target, TrendingUp } from 'lucide-react';
import { useDRepOutcomeSummary } from '@/hooks/queries';
import type { DRepOutcomeSummary as DRepOutcomeSummaryType } from '@/lib/proposalOutcomes';

interface Props {
  drepId: string;
}

export function DRepOutcomeSummary({ drepId }: Props) {
  const { data: raw, isLoading } = useDRepOutcomeSummary(drepId);
  const summary = raw as DRepOutcomeSummaryType | undefined;

  if (isLoading || !summary || summary.enactedProposals === 0) return null;

  const totalResolved = summary.deliveredCount + summary.partialCount + summary.notDeliveredCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Treasury Track Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* High-level stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="Enacted Proposals"
            value={summary.enactedProposals}
            subtitle={`of ${summary.totalVotedProposals} voted`}
          />
          {summary.avgDeliveryScore != null && (
            <StatBox
              label="Avg Delivery Score"
              value={summary.avgDeliveryScore}
              subtitle="/100"
              color={
                summary.avgDeliveryScore >= 70
                  ? 'text-green-600 dark:text-green-400'
                  : summary.avgDeliveryScore >= 40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              }
            />
          )}
        </div>

        {/* Outcome breakdown */}
        {totalResolved > 0 && (
          <div className="flex flex-wrap gap-2">
            {summary.deliveredCount > 0 && (
              <Badge
                variant="outline"
                className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
              >
                <CheckCircle2 className="h-3 w-3" />
                {summary.deliveredCount} delivered
              </Badge>
            )}
            {summary.partialCount > 0 && (
              <Badge
                variant="outline"
                className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
              >
                <AlertTriangle className="h-3 w-3" />
                {summary.partialCount} partial
              </Badge>
            )}
            {summary.notDeliveredCount > 0 && (
              <Badge
                variant="outline"
                className="gap-1 bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
              >
                <XCircle className="h-3 w-3" />
                {summary.notDeliveredCount} not delivered
              </Badge>
            )}
            {summary.inProgressCount > 0 && (
              <Badge
                variant="outline"
                className="gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
              >
                <Clock className="h-3 w-3" />
                {summary.inProgressCount} in progress
              </Badge>
            )}
          </div>
        )}

        {/* Approval success rate */}
        {summary.approvalSuccessRate != null && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {summary.approvalSuccessRate}% of proposals this DRep voted Yes on have delivered
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: number;
  subtitle: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color ?? ''}`}>
        {value}
        <span className="text-xs font-normal text-muted-foreground ml-0.5">{subtitle}</span>
      </p>
    </div>
  );
}
