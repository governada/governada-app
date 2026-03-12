'use client';

import { useDelegatorIntelligence } from '@/hooks/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, BarChart3, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

interface DelegatorIntelligenceProps {
  drepId: string;
}

/**
 * Delegator Intelligence — shows DReps what their delegators care about.
 *
 * Three sections:
 * 1. Top governance priorities (aggregated from citizen priority signals)
 * 2. Delegator sentiment on proposals (support/oppose/abstain breakdown)
 * 3. Engagement level (% of delegators who have submitted signals)
 */
export function DelegatorIntelligence({ drepId }: DelegatorIntelligenceProps) {
  const { data, isLoading } = useDelegatorIntelligence(drepId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!data || (data.topPriorities.length === 0 && data.sentimentByProposal.length === 0)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Delegator Intelligence
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No delegator signals yet. As your delegators express governance priorities and vote on
          proposals, their aggregated preferences will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Delegator Intelligence
        </h3>
      </div>

      {/* Engagement summary */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Delegator Engagement
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{data.avgEngagement}%</p>
            <p className="text-xs text-muted-foreground">
              {data.engagedDelegators} of {data.totalDelegators} delegators have expressed
              preferences
            </p>
          </div>
          <div className="rounded-full bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      {/* Top priorities */}
      {data.topPriorities.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your delegators care about...
            </p>
          </div>
          <div className="space-y-2">
            {data.topPriorities.map((p, i) => {
              const maxCount = data.topPriorities[0].count;
              const pct = maxCount > 0 ? (p.count / maxCount) * 100 : 0;
              return (
                <div key={p.priority} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {i + 1}. {p.priority}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {p.count} signals
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sentiment on proposals */}
      {data.sentimentByProposal.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Delegator Sentiment on Proposals
          </p>
          <div className="space-y-2">
            {data.sentimentByProposal.slice(0, 5).map((s) => {
              const total = s.total || 1;
              const supportPct = Math.round((s.support / total) * 100);
              const opposePct = Math.round((s.oppose / total) * 100);
              return (
                <div
                  key={`${s.proposalTxHash}-${s.proposalIndex}`}
                  className="rounded-xl bg-muted/30 p-3 space-y-2"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {s.title || `Proposal ${s.proposalTxHash.slice(0, 8)}...`}
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-500">
                      <ThumbsUp className="h-3 w-3" /> {supportPct}%
                    </span>
                    <span className="flex items-center gap-1 text-rose-500">
                      <ThumbsDown className="h-3 w-3" /> {opposePct}%
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Minus className="h-3 w-3" /> {100 - supportPct - opposePct}%
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {s.total} signal{s.total !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Stacked bar */}
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${supportPct}%` }} />
                    <div className="h-full bg-rose-500" style={{ width: `${opposePct}%` }} />
                    <div
                      className="h-full bg-muted-foreground/30"
                      style={{ width: `${100 - supportPct - opposePct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
