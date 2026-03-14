'use client';

import Link from 'next/link';
import { ArrowLeft, Server, ExternalLink } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSPOSummary } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * WorkspacePoolProfilePage — Pool governance identity for SPOs.
 *
 * JTBD: "What does my pool's governance profile look like?"
 * Shows current profile state and links to the public profile page.
 */
export function WorkspacePoolProfilePage() {
  const { segment, poolId } = useSegment();
  const { data: summaryRaw, isLoading } = useSPOSummary(poolId);

  if (segment !== 'spo') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">This page is for SPOs.</p>
        <Button asChild>
          <Link href="/">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const summary = summaryRaw as Record<string, unknown> | undefined;
  const poolName = (summary?.poolName as string) ?? 'Your Pool';
  const ticker = (summary?.ticker as string) ?? '';
  const governanceScore = Math.round((summary?.governanceScore as number) ?? 0);
  const voteCount = (summary?.voteCount as number) ?? 0;
  const hasStatement = !!(summary?.governanceStatement as string);
  const participationRate = Math.round((summary?.participationRate as number) ?? 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6" data-discovery="ws-spo-profile">
      <div className="flex items-center gap-3">
        <Link
          href="/workspace"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Pool Profile</h1>
      </div>

      {/* Profile summary */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {ticker ? `[${ticker}] ` : ''}
              {poolName}
            </h2>
            <p className="text-sm text-muted-foreground">
              Governance Score: {governanceScore} &middot; {voteCount} votes cast
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <span className="text-sm text-muted-foreground">Participation Rate</span>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {participationRate}%
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <span className="text-sm text-muted-foreground">Governance Statement</span>
            <span
              className={`text-sm font-medium ${hasStatement ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
            >
              {hasStatement ? 'Published' : 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {!hasStatement && (
          <p className="text-sm text-muted-foreground">
            Adding a governance statement helps delegators understand your voting philosophy.
          </p>
        )}
        {poolId && (
          <Button asChild variant="outline" className="w-full gap-2">
            <Link href={`/pool/${encodeURIComponent(poolId)}`}>
              View Public Profile <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
