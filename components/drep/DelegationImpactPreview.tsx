'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { Card, CardContent } from '@/components/ui/card';
import { Vote, FileText, Users } from 'lucide-react';

interface DelegationImpactPreviewProps {
  drepName: string;
  participationRate: number;
  totalVotes: number;
  rationaleRate: number;
  votingPowerAda: number;
  delegatorCount: number;
  compact?: boolean;
}

/**
 * Shows undelegated citizens what delegating to this DRep would mean in practice.
 * Hidden for anonymous users (who haven't connected a wallet) and for users
 * who already have a delegation.
 *
 * At hands_off depth, renders a compact single-line summary instead of the
 * full 3-column grid.
 */
export function DelegationImpactPreview({
  drepName,
  participationRate,
  totalVotes,
  rationaleRate,
  votingPowerAda,
  delegatorCount,
  compact,
}: DelegationImpactPreviewProps) {
  const { segment, delegatedDrep } = useSegment();
  const { isAtLeast } = useGovernanceDepth();

  // Only show to citizens who are NOT currently delegated
  if (segment !== 'citizen' || delegatedDrep) return null;

  const isCompact = compact ?? !isAtLeast('informed');

  if (isCompact) {
    return (
      <Card className="border-border/50 bg-card/70 backdrop-blur-md py-3">
        <CardContent className="flex items-center gap-3">
          <Vote className="h-4 w-4 shrink-0 text-primary/70" />
          <p className="text-sm text-muted-foreground">
            Votes on {participationRate}% of proposals &middot; {rationaleRate}% with reasoning
          </p>
        </CardContent>
      </Card>
    );
  }

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
