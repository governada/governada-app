'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Vote } from 'lucide-react';

interface MandatePriority {
  priority: string;
  label: string;
  score: number;
  weightedScore: number;
  rank: number;
  firstChoiceCount: number;
  totalVoters: number;
  trend: number | null;
}

interface MandateData {
  epoch: number;
  priorities: MandatePriority[];
  totalVoters: number;
  updatedAt: string;
}

async function fetchMandate(): Promise<MandateData | null> {
  const res = await fetch('/api/community/mandate');
  if (!res.ok) return null;
  return res.json();
}

export function CitizenMandate() {
  const { data, isLoading } = useQuery({
    queryKey: ['community-mandate'],
    queryFn: fetchMandate,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <MandateSkeleton />;
  }

  if (!data || data.totalVoters === 0 || data.priorities.length === 0) {
    return null; // No data yet — silent when empty
  }

  const maxScore = data.priorities[0]?.weightedScore || 1;

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Citizen Mandate</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {data.totalVoters} voter{data.totalVoters !== 1 ? 's' : ''} &middot; Epoch {data.epoch}
        </span>
      </div>

      <div className="space-y-2.5">
        {data.priorities.slice(0, 8).map((p) => (
          <MandateBar key={p.priority} priority={p} maxScore={maxScore} />
        ))}
      </div>
    </div>
  );
}

function MandateBar({ priority, maxScore }: { priority: MandatePriority; maxScore: number }) {
  const pct = Math.round((priority.weightedScore / maxScore) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          <span className="text-muted-foreground mr-1.5 tabular-nums">{priority.rank}.</span>
          {priority.label}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {priority.trend !== null && priority.trend !== 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5',
                priority.trend > 0 ? 'text-emerald-500' : 'text-rose-500',
              )}
            >
              {priority.trend > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
            </span>
          )}
          <span className="tabular-nums">{priority.firstChoiceCount} first</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-primary/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MandateSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
            <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
