'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { HeartPulse, Users } from 'lucide-react';
import type { PollResultsResponse } from '@/types/supabase';
import { usePollResults } from '@/hooks/queries';

interface DelegatorPulseProps {
  txHash: string;
  proposalIndex: number;
  drepId: string;
}

interface Counts {
  yes: number;
  no: number;
  abstain: number;
  total: number;
}

export function DelegatorPulse({ txHash, proposalIndex, drepId }: DelegatorPulseProps) {
  const params = new URLSearchParams({
    proposalTxHash: txHash,
    proposalIndex: String(proposalIndex),
    drepId,
  }).toString();
  const { data: raw, isLoading: loading } = usePollResults(params);
  const results = raw as PollResultsResponse | undefined;

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!results) return null;

  const { community, delegators } = results;
  const hasAnyVotes = community.total > 0 || (delegators?.total ?? 0) > 0;
  if (!hasAnyVotes) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">
          <HeartPulse className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-medium">Delegator Pulse</h3>
        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
          Pro
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PulseColumn
          label="Your Delegators"
          icon={<HeartPulse className="h-3 w-3" />}
          counts={delegators ?? { yes: 0, no: 0, abstain: 0, total: 0 }}
          emptyText="No delegator votes yet"
        />
        <PulseColumn
          label="Community"
          icon={<Users className="h-3 w-3" />}
          counts={community}
          emptyText="No community votes yet"
        />
      </div>

      <p className="text-xs text-muted-foreground pt-1">
        Non-binding sentiment from ADA holders — distinct from on-chain DRep votes.
      </p>
    </div>
  );
}

function PulseColumn({
  label,
  icon,
  counts,
  emptyText,
}: {
  label: string;
  icon: React.ReactNode;
  counts: Counts;
  emptyText: string;
}) {
  const { yes, no, abstain, total } = counts;

  if (total === 0) {
    return (
      <div className="rounded-lg border p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon} {label}
        </div>
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  const yp = Math.round((yes / total) * 100);
  const np = Math.round((no / total) * 100);
  const ap = Math.round((abstain / total) * 100);

  return (
    <div className="rounded-lg border p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon} {label}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{total}</span>
      </div>

      {/* Stacked bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
        {yes > 0 && <div className="bg-green-500 h-full" style={{ width: `${yp}%` }} />}
        {no > 0 && <div className="bg-red-500 h-full" style={{ width: `${np}%` }} />}
        {abstain > 0 && <div className="bg-amber-500 h-full" style={{ width: `${ap}%` }} />}
      </div>

      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span className="text-green-600 dark:text-green-400">{yp}% Y</span>
        <span className="text-red-600 dark:text-red-400">{np}% N</span>
        <span className="text-amber-600 dark:text-amber-400">{ap}% A</span>
      </div>
    </div>
  );
}
