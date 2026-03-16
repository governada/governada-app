'use client';

/**
 * ProposerTrackRecord — compact card showing the proposal team's governance history.
 *
 * Shows: total proposals submitted, ratified count, expired/dropped count,
 * delivery data (if available), and average community review score.
 */

import { UserCheck, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProposerTrackRecord } from '@/hooks/useProposerTrackRecord';
import { cn } from '@/lib/utils';

interface ProposerTrackRecordProps {
  proposalTxHash: string;
  proposalIndex: number;
}

export function ProposerTrackRecord({ proposalTxHash, proposalIndex }: ProposerTrackRecordProps) {
  const { data, isLoading, isError } = useProposerTrackRecord(proposalTxHash, proposalIndex);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5" />
            Proposer Track Record
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Track record unavailable</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If only 1 proposal (this one) and no delivery data, show minimal state
  if (data.totalProposals <= 1 && data.deliveredCount === 0) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5" />
            Proposer Track Record
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            First-time proposer — no prior governance proposals found.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasDeliveryData =
    data.deliveredCount > 0 || data.partialCount > 0 || data.notDeliveredCount > 0;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5" />
          Proposer Track Record
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {/* Total proposals */}
          <div>
            <span className="text-muted-foreground">Total Proposals</span>
            <p className="font-medium text-foreground tabular-nums">{data.totalProposals}</p>
          </div>

          {/* Ratified */}
          <div>
            <span className="text-muted-foreground">Ratified</span>
            <p className="font-medium text-foreground tabular-nums flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {data.ratifiedCount}
            </p>
          </div>

          {/* Expired */}
          <div>
            <span className="text-muted-foreground">Expired</span>
            <p className="font-medium text-foreground tabular-nums flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-500" />
              {data.expiredCount}
            </p>
          </div>

          {/* Dropped */}
          <div>
            <span className="text-muted-foreground">Dropped</span>
            <p className="font-medium text-foreground tabular-nums flex items-center gap-1">
              <XCircle className="h-3 w-3 text-rose-500" />
              {data.droppedCount}
            </p>
          </div>

          {/* Delivery stats (if available) */}
          {hasDeliveryData && (
            <div className="col-span-2 border-t border-border/50 pt-2">
              <span className="text-muted-foreground">Delivery Record</span>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className={cn(
                    'flex items-center gap-1',
                    data.deliveredCount > 0 ? 'text-emerald-500' : 'text-muted-foreground',
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {data.deliveredCount} delivered
                </span>
                {data.partialCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Clock className="h-3 w-3" />
                    {data.partialCount} partial
                  </span>
                )}
                {data.notDeliveredCount > 0 && (
                  <span className="flex items-center gap-1 text-rose-500">
                    <XCircle className="h-3 w-3" />
                    {data.notDeliveredCount} failed
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Average community score */}
          {data.avgCommunityScore != null && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Avg Community Score</span>
              <p className="font-medium text-foreground tabular-nums">
                {data.avgCommunityScore.toFixed(1)} / 5
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
