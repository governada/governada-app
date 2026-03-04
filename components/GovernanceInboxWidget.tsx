'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Inbox,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Vote,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { PositionStatementEditor } from '@/components/PositionStatementEditor';
import { useDashboardInbox } from '@/hooks/queries';

interface PendingProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  proposalType: string;
  priority: 'critical' | 'important' | 'standard';
  epochsRemaining: number | null;
  perProposalScoreImpact: number;
}

interface InboxData {
  pendingProposals: PendingProposal[];
  pendingCount: number;
  votedThisEpoch: number;
  currentEpoch: number;
  scoreImpact: {
    currentScore: number;
    simulatedScore: number;
    potentialGain: number;
    perProposalGain: number;
  };
  criticalCount: number;
  urgentCount: number;
}

const PRIORITY_STYLES = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  important: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  standard: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function GovernanceInboxWidget({ drepId }: { drepId: string }) {
  const { data: raw, isLoading: loading } = useDashboardInbox(drepId);
  const data = raw as InboxData | undefined;

  useEffect(() => {
    if (data?.pendingCount && data.pendingCount > 0) {
      try {
        posthog?.capture('inbox_widget_viewed', {
          drepId,
          pendingCount: data.pendingCount,
          criticalCount: data.criticalCount,
        });
      } catch {}
    }
  }, [data, drepId]);

  if (loading) {
    return (
      <Card className="mb-6 border-2 border-amber-500/30">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.pendingCount === 0) {
    return (
      <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
        <Vote className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        <span className="text-xs font-medium text-green-700 dark:text-green-400">
          All caught up!
        </span>
      </div>
    );
  }

  const topProposals = data.pendingProposals.slice(0, 3);
  const hasCritical = data.criticalCount > 0;
  const hasUrgent = data.urgentCount > 0;

  return (
    <Card
      className={`mb-6 border-2 ${hasCritical ? 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent' : 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent'}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Action Required</CardTitle>
            <Badge variant="outline" className="text-xs font-bold tabular-nums">
              {data.pendingCount}
            </Badge>
            {hasCritical && (
              <Badge variant="outline" className={PRIORITY_STYLES.critical + ' text-[10px]'}>
                {data.criticalCount} Critical
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            {data.scoreImpact.potentialGain > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <TrendingUp className="h-3.5 w-3.5" />+{data.scoreImpact.potentialGain} pts possible
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Draft rationale banner */}
        <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Draft rationale before voting</span> —
            proposals with rationale boost your score by up to 35%
          </span>
        </div>

        {/* Urgency callout */}
        {hasUrgent && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {data.urgentCount} proposal{data.urgentCount !== 1 ? 's' : ''} expiring within 2 epochs
          </div>
        )}

        {/* Top proposals */}
        <div className="space-y-2">
          {topProposals.map((p) => (
            <div
              key={`${p.txHash}-${p.proposalIndex}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${PRIORITY_STYLES[p.priority]}`}
                >
                  {p.priority === 'critical'
                    ? 'Critical'
                    : p.priority === 'important'
                      ? 'Important'
                      : 'Standard'}
                </Badge>
                <span className="truncate text-xs">
                  {p.title || `Proposal ${p.txHash.slice(0, 8)}...`}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.epochsRemaining != null && p.epochsRemaining <= 3 && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {p.epochsRemaining}ep
                  </span>
                )}
                <PositionStatementEditor
                  drepId={drepId}
                  proposalTxHash={p.txHash}
                  proposalIndex={p.proposalIndex}
                  proposalTitle={p.title || `Proposal ${p.txHash.slice(0, 8)}...`}
                />
                <Link
                  href={`/dashboard/inbox?drepId=${encodeURIComponent(drepId)}&proposal=${p.txHash}`}
                >
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1">
                    <FileText className="h-3 w-3" />
                    Draft
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {data.pendingCount > 3 && (
          <p className="text-[10px] text-muted-foreground">
            +{data.pendingCount - 3} more proposal{data.pendingCount - 3 !== 1 ? 's' : ''}
          </p>
        )}

        <Link
          href={`/dashboard/inbox?drepId=${encodeURIComponent(drepId)}`}
          onClick={() => {
            try {
              posthog?.capture('inbox_widget_cta_clicked', {
                drepId,
                pendingCount: data.pendingCount,
              });
            } catch {}
          }}
        >
          <Button variant="outline" size="sm" className="w-full gap-2 mt-1">
            Open Governance Inbox
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
