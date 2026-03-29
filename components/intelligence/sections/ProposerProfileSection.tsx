'use client';

/**
 * ProposerProfileSection — track record for review brief.
 *
 * Wraps useProposerTrackRecord hook (same as IntelPanel's ProposerTrackRecordCard).
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProposerTrackRecord } from '@/hooks/useProposerTrackRecord';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProposerProfileSectionProps {
  proposalId: string;
  proposalIndex: number;
}

// ---------------------------------------------------------------------------
// StatCell
// ---------------------------------------------------------------------------

function StatCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
      <p className={cn('text-sm font-semibold tabular-nums', color ?? 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProposerProfileSection({ proposalId, proposalIndex }: ProposerProfileSectionProps) {
  const { data, isLoading, isError, error } = useProposerTrackRecord(proposalId, proposalIndex);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading track record...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-xs text-red-400 py-1">
        {error instanceof Error ? error.message : 'Failed to load'}
      </p>
    );
  }

  if (!data) {
    return <p className="text-xs text-muted-foreground/60 py-1">No track record available</p>;
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <StatCell label="Total proposals" value={data.totalProposals} />
        <StatCell label="Ratified" value={data.ratifiedCount} color="text-emerald-400" />
        <StatCell label="Expired" value={data.expiredCount} color="text-amber-400" />
        <StatCell label="Dropped" value={data.droppedCount} color="text-red-400" />
      </div>
      {(data.deliveredCount > 0 || data.partialCount > 0 || data.notDeliveredCount > 0) && (
        <div className="border-t border-border pt-2">
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
            Delivery
          </span>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <StatCell label="Delivered" value={data.deliveredCount} color="text-emerald-400" />
            <StatCell label="Partial" value={data.partialCount} color="text-amber-400" />
            <StatCell label="Not delivered" value={data.notDeliveredCount} color="text-red-400" />
          </div>
        </div>
      )}
      {data.avgCommunityScore !== null && (
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Avg community score</span>
            <span className="font-medium text-foreground tabular-nums">
              {data.avgCommunityScore}/5
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
