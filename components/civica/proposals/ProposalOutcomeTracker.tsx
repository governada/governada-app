'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  BarChart3,
  Users,
  ThumbsUp,
  Target,
} from 'lucide-react';
import { ProposalDeliveryBadge } from './ProposalDeliveryBadge';
import type { ProposalOutcome } from '@/lib/proposalOutcomes';

interface Props {
  outcome: ProposalOutcome;
}

export function ProposalOutcomeTracker({ outcome }: Props) {
  const substantiveResponses =
    outcome.deliveredCount + outcome.partialCount + outcome.notDeliveredCount;
  const hasResponses = outcome.totalPollResponses > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Delivery Tracking
          <ProposalDeliveryBadge status={outcome.deliveryStatus} score={outcome.deliveryScore} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delivery Score */}
        {outcome.deliveryScore != null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Delivery Score
              </span>
              <span className="font-semibold tabular-nums">{outcome.deliveryScore}/100</span>
            </div>
            <Progress value={outcome.deliveryScore} className="h-2" />
          </div>
        )}

        {/* Community Assessment Breakdown */}
        {hasResponses && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Community Assessment
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                {outcome.totalPollResponses} responses
              </Badge>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <AssessmentBar
                label="Delivered"
                count={outcome.deliveredCount}
                total={substantiveResponses}
                icon={CheckCircle2}
                color="bg-green-500"
              />
              <AssessmentBar
                label="Partial"
                count={outcome.partialCount}
                total={substantiveResponses}
                icon={AlertTriangle}
                color="bg-amber-500"
              />
              <AssessmentBar
                label="Not Delivered"
                count={outcome.notDeliveredCount}
                total={substantiveResponses}
                icon={XCircle}
                color="bg-red-500"
              />
              <AssessmentBar
                label="Too Early"
                count={outcome.tooEarlyCount}
                total={outcome.totalPollResponses}
                icon={Clock}
                color="bg-blue-500"
              />
            </div>
          </div>
        )}

        {/* Would Approve Again */}
        {outcome.wouldApproveAgainPct != null && (
          <div className="flex items-center gap-2 text-sm">
            <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Would approve again:</span>
            <span
              className={`font-semibold tabular-nums ${
                outcome.wouldApproveAgainPct >= 60
                  ? 'text-green-600 dark:text-green-400'
                  : outcome.wouldApproveAgainPct >= 40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {outcome.wouldApproveAgainPct}%
            </span>
          </div>
        )}

        {/* Milestone Progress */}
        {outcome.milestonesTotal != null && outcome.milestonesTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Milestones</span>
              <span className="font-semibold tabular-nums">
                {outcome.milestonesCompleted ?? 0}/{outcome.milestonesTotal}
              </span>
            </div>
            <Progress
              value={((outcome.milestonesCompleted ?? 0) / outcome.milestonesTotal) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Time Since Enactment */}
        {outcome.epochsSinceEnactment != null && (
          <p className="text-xs text-muted-foreground">
            Enacted {outcome.epochsSinceEnactment} epochs ago (~
            {Math.round(outcome.epochsSinceEnactment * 5)} days)
          </p>
        )}

        {/* Empty state */}
        {!hasResponses && (
          <p className="text-sm text-muted-foreground">
            {outcome.deliveryStatus === 'in_progress'
              ? 'This proposal was recently enacted. Community assessment will open after the accountability delay period.'
              : 'No community assessments yet. Be the first to evaluate delivery via the accountability poll.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AssessmentBar({
  label,
  count,
  total,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  total: number;
  icon: typeof CheckCircle2;
  color: string;
}) {
  if (total === 0) return null;
  const pct = Math.round((count / total) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="font-mono tabular-nums">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
