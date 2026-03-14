'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Vote, FileText, Users } from 'lucide-react';

interface DelegationImpactPreviewProps {
  drepName: string;
  participationRate: number;
  totalVotes: number;
  rationaleRate: number;
  votingPowerAda: number;
  delegatorCount: number;
}

/**
 * Shows undelegated citizens what delegating to this DRep would mean in practice.
 * Hidden for anonymous users (who haven't connected a wallet) and for users
 * who already have a delegation.
 */
export function DelegationImpactPreview({
  drepName,
  participationRate,
  totalVotes,
  rationaleRate,
  votingPowerAda,
  delegatorCount,
}: DelegationImpactPreviewProps) {
  const { segment, delegatedDrep } = useSegment();

  // Only show to citizens who are NOT currently delegated
  if (segment !== 'citizen' || delegatedDrep) return null;

  return (
    <Card className="border-border/50 bg-card/70 backdrop-blur-md py-4">
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">What delegating means</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Participation */}
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Vote className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums">
                {participationRate}% of proposals voted on
              </p>
              <p className="text-xs text-muted-foreground">Participation</p>
            </div>
          </div>

          {/* Transparency */}
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums">
                {rationaleRate}% votes with reasoning
              </p>
              <p className="text-xs text-muted-foreground">Transparency</p>
            </div>
          </div>

          {/* Community */}
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums">
                {delegatorCount.toLocaleString()} other delegator{delegatorCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">Community</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Covers 5 of 7 governance decision types</p>
      </CardContent>
    </Card>
  );
}
