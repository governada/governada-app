'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, Vote, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DelegationStoryData {
  delegatedSince: number;
  currentDrep: string;
  totalVotes: number;
  scoreRange: [number, number];
  epochsActive: number;
}

async function fetchDelegationStory(): Promise<DelegationStoryData> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session
  }
  const res = await fetch('/api/governance/delegation-story', { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural ?? singular + 's'}`;
}

export function DelegationStory() {
  const { data, isLoading, error } = useQuery<DelegationStoryData>({
    queryKey: ['delegation-story'],
    queryFn: fetchDelegationStory,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (error || !data) {
    return null; // Fail silently — this is supplementary content
  }

  // Don't render if no delegation history
  if (data.epochsActive === 0 && data.totalVotes === 0) {
    return null;
  }

  const [minScore, maxScore] = data.scoreRange;
  const scoreStable = maxScore - minScore <= 5;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Your Delegation Story
      </h2>

      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>
          You delegated to <span className="font-medium text-foreground">{data.currentDrep}</span>{' '}
          in epoch{' '}
          <span className="tabular-nums font-medium text-foreground">{data.delegatedSince}</span>.
          {data.epochsActive > 0 && (
            <>
              {' '}
              Your delegation has been active for{' '}
              <span className="font-medium text-foreground">
                {pluralize(data.epochsActive, 'epoch')}
              </span>
              .
            </>
          )}
        </p>

        {data.totalVotes > 0 && (
          <p className="flex items-start gap-2">
            <Vote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Since your delegation, they have voted on{' '}
              <span className="font-medium text-foreground">
                {pluralize(data.totalVotes, 'proposal')}
              </span>
              .
            </span>
          </p>
        )}

        <p className="flex items-start gap-2">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            {scoreStable ? (
              <>
                Their score has remained steady around{' '}
                <span className="font-medium text-foreground tabular-nums">{minScore}</span>.
              </>
            ) : (
              <>
                Their score has ranged from{' '}
                <span className="font-medium text-foreground tabular-nums">{minScore}</span> to{' '}
                <span className="font-medium text-foreground tabular-nums">{maxScore}</span> during
                your delegation.
              </>
            )}
          </span>
        </p>
      </div>
    </div>
  );
}
