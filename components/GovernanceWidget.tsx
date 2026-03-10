'use client';

import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { useGovernanceSummary } from '@/hooks/queries';
import { Badge } from '@/components/ui/badge';
import { Scroll, ChevronRight, AlertTriangle, Wallet } from 'lucide-react';

interface GovernanceSummary {
  openCount: number;
  criticalOpenCount: number;
  importantOpenCount: number;
  currentEpoch: number;
  drepVotedCount?: number;
  drepMissingCount?: number;
}

export function GovernanceWidget() {
  const { delegatedDrepId } = useWallet();
  const { data: rawData, isLoading } = useGovernanceSummary(delegatedDrepId);
  const data = (rawData as GovernanceSummary) ?? null;

  if (isLoading) {
    return <div className="h-12 animate-pulse bg-muted rounded-lg" />;
  }

  if (!data) return null;

  const hasDrepData = data.drepVotedCount != null && data.drepMissingCount != null;
  const totalOpen = data.openCount;
  const hasCritical = data.criticalOpenCount > 0;

  const borderColor = hasCritical
    ? 'border-l-red-500'
    : hasDrepData && data.drepMissingCount === 0
      ? 'border-l-green-500'
      : 'border-l-primary';

  return (
    <Link href="/governance/proposals">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors cursor-pointer border-l-4 ${borderColor}`}
      >
        <Scroll className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold tabular-nums">{totalOpen}</span>
          <span className="text-xs text-muted-foreground">
            Open Proposal{totalOpen !== 1 ? 's' : ''}
          </span>
          {hasCritical && (
            <Badge
              variant="outline"
              className="bg-red-500/10 text-red-700 dark:text-red-400 gap-0.5 text-[10px] px-1.5 py-0"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {data.criticalOpenCount} critical
            </Badge>
          )}
        </div>

        <span className="text-border mx-1">|</span>

        {hasDrepData ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground">Your DRep:</span>
            <span className="text-xs font-medium tabular-nums">
              {data.drepVotedCount}/{totalOpen} voted
            </span>
            {totalOpen > 0 && (
              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    data.drepMissingCount === 0 ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                  style={{
                    width: `${totalOpen > 0 ? (data.drepVotedCount! / totalOpen) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <Wallet className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Connect wallet to track your DRep</span>
          </div>
        )}

        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
      </div>
    </Link>
  );
}
