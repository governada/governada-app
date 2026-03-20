'use client';

import { BarChart3, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureGate } from '@/components/FeatureGate';

interface ConsensusData {
  proposals: {
    txHash: string;
    index: number;
    title: string;
    support: number;
    oppose: number;
    unsure: number;
    total: number;
  }[];
  aggregate: {
    support: number;
    oppose: number;
    unsure: number;
    total: number;
    proposalCount: number;
  };
}

/**
 * CommunityConsensus -- Aggregated sentiment across all active proposals.
 *
 * Feature-flagged behind 'community_consensus'. Shows at-a-glance how
 * the citizen community feels about governance as a whole, not just one proposal.
 *
 * JTBD: "What does the community think about current governance?"
 */
function CommunityConsensusInner() {
  const { data, isLoading, isError } = useQuery<ConsensusData>({
    queryKey: ['community-consensus'],
    queryFn: async () => {
      const res = await fetch('/api/engagement/sentiment/consensus');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4 sm:p-5 space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError) return null;

  // No signals yet — show an inviting empty state instead of hiding
  if (!data || data.aggregate.total === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Community Consensus
          </h3>
        </div>
        <p className="text-sm text-foreground font-medium">No citizen signals yet this epoch</p>
        <p className="text-xs text-muted-foreground">
          Be the first to share your perspective on active proposals — your signal helps other
          citizens understand community sentiment.
        </p>
      </div>
    );
  }

  const { aggregate, proposals } = data;
  const supportPct = Math.round((aggregate.support / aggregate.total) * 100);
  const opposePct = Math.round((aggregate.oppose / aggregate.total) * 100);
  const unsurePct = Math.round((aggregate.unsure / aggregate.total) * 100);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Community Consensus
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {aggregate.total} signal{aggregate.total !== 1 ? 's' : ''} &middot;{' '}
          {aggregate.proposalCount} proposal{aggregate.proposalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stacked consensus bar */}
      <div className="space-y-2">
        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
          {supportPct > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${supportPct}%` }}
            />
          )}
          {unsurePct > 0 && (
            <div
              className="h-full bg-amber-500 transition-all duration-700"
              style={{ width: `${unsurePct}%` }}
            />
          )}
          {opposePct > 0 && (
            <div
              className="h-full bg-red-500 transition-all duration-700"
              style={{ width: `${opposePct}%` }}
            />
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-emerald-500" />
            {supportPct}% support
          </span>
          <span className="flex items-center gap-1">
            <HelpCircle className="h-3 w-3 text-amber-500" />
            {unsurePct}% unsure
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown className="h-3 w-3 text-red-500" />
            {opposePct}% oppose
          </span>
        </div>
      </div>

      {/* Top proposals by engagement */}
      {proposals.length > 0 && (
        <div className="space-y-1.5">
          {proposals.slice(0, 3).map((p) => {
            const pTotal = p.total;
            const pSupportPct = pTotal > 0 ? Math.round((p.support / pTotal) * 100) : 0;
            return (
              <div key={`${p.txHash}:${p.index}`} className="flex items-center gap-2 text-xs">
                <span className="inline-flex h-1 w-8 rounded-full bg-muted overflow-hidden shrink-0">
                  <span
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${pSupportPct}%` }}
                  />
                </span>
                <span className="truncate min-w-0 flex-1 text-muted-foreground">{p.title}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
                  {pTotal}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CommunityConsensus() {
  return (
    <FeatureGate flag="community_consensus">
      <CommunityConsensusInner />
    </FeatureGate>
  );
}
