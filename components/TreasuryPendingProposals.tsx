'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardListSkeleton } from '@/components/ui/content-skeletons';
import { Scale, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatAda } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';
import { useTreasuryPending } from '@/hooks/queries';

interface PendingData {
  proposals: Array<{
    txHash: string;
    index: number;
    title: string;
    withdrawalAda: number;
    pctOfBalance: number;
    treasuryTier: string | null;
    proposedEpoch: number;
  }>;
  totalAda: number;
  pctOfTreasury: string;
  treasuryBalanceAda: number;
}

interface Props {
  treasuryBalanceAda: number;
  runwayMonths: number;
}

const tierColors: Record<string, string> = {
  routine: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  significant: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  major: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function TreasuryPendingProposals({ treasuryBalanceAda, runwayMonths }: Props) {
  const { data: raw, isLoading: loading } = useTreasuryPending();
  const data = raw as PendingData | undefined;

  useEffect(() => {
    if (data?.proposals?.length) {
      posthog.capture('treasury_pending_viewed', {
        count: data.proposals.length,
        total_ada: data.totalAda,
      });
    }
  }, [data]);

  if (loading) return <CardListSkeleton count={3} />;
  if (!data || !data.proposals.length) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          <Scale className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No pending treasury withdrawal proposals.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Pending Treasury Proposals
          </CardTitle>
          <div className="text-sm">
            <span className="font-semibold">{formatAda(data.totalAda)} ADA</span>
            <span className="text-muted-foreground ml-1">({data.pctOfTreasury}% of treasury)</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.proposals.map((p) => (
          <Link
            key={`${p.txHash}-${p.index}`}
            href={`/proposals/${p.txHash}/${p.index}`}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{p.title}</span>
                {p.treasuryTier && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${tierColors[p.treasuryTier] || ''}`}
                  >
                    {p.treasuryTier}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">{formatAda(p.withdrawalAda)} ADA</span>
                <span>{p.pctOfBalance.toFixed(2)}% of treasury</span>
                <span>Epoch {p.proposedEpoch}</span>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Link>
        ))}

        {parseFloat(data.pctOfTreasury) > 5 && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Pending proposals exceed 5% of the treasury balance.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
