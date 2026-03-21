'use client';

import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardListSkeleton } from '@/components/ui/content-skeletons';
import { Scale, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatAda } from '@/lib/treasury';
import type { DRepTreasuryVote } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';
import { useTreasuryPending } from '@/hooks/queries';

interface PendingData {
  proposals: Array<{
    txHash: string;
    index: number;
    title: string;
    withdrawalAda: number | null;
    pctOfBalance: number;
    treasuryTier: string | null;
    proposedEpoch: number;
  }>;
  totalAda: number;
  pctOfTreasury: string;
  treasuryBalanceAda: number;
}

interface NclImpact {
  utilizationPct: number;
  remainingAda: number;
  nclAda: number;
}

interface Props {
  treasuryBalanceAda: number;
  runwayMonths: number;
  /** NCL data for per-proposal impact indicators */
  nclImpact?: NclImpact | null;
  /** Per-proposal DRep votes for inline vote badges */
  drepVotes?: DRepTreasuryVote[];
}

const tierColors: Record<string, string> = {
  routine: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  significant: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  major: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const voteColors: Record<string, string> = {
  Yes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  No: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Abstain: 'bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400',
};

export function TreasuryPendingProposals({ nclImpact, drepVotes }: Props) {
  const { data: raw, isLoading: loading } = useTreasuryPending();
  const data = raw as PendingData | undefined;

  const voteMap = useMemo(() => {
    if (!drepVotes?.length) return new Map<string, string>();
    return new Map(drepVotes.map((v) => [`${v.txHash}-${v.index}`, v.vote]));
  }, [drepVotes]);

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
            href={`/proposal/${p.txHash}/${p.index}`}
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
                {voteMap.get(`${p.txHash}-${p.index}`) && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${voteColors[voteMap.get(`${p.txHash}-${p.index}`)!] || ''}`}
                  >
                    {voteMap.get(`${p.txHash}-${p.index}`) === 'Yes'
                      ? 'Your DRep: Yes'
                      : voteMap.get(`${p.txHash}-${p.index}`) === 'No'
                        ? 'Your DRep: No'
                        : 'Your DRep: Abstain'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {p.withdrawalAda != null
                    ? `₳${formatAda(p.withdrawalAda)}`
                    : 'Amount not specified'}
                </span>
                {p.withdrawalAda != null && p.pctOfBalance > 0 && (
                  <span>{p.pctOfBalance.toFixed(2)}% of treasury</span>
                )}
                <span>Epoch {p.proposedEpoch}</span>
              </div>
              {nclImpact && p.withdrawalAda != null && p.withdrawalAda > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  If enacted: NCL {Math.round(nclImpact.utilizationPct)}% →{' '}
                  {Math.round(
                    ((nclImpact.nclAda - nclImpact.remainingAda + p.withdrawalAda) /
                      nclImpact.nclAda) *
                      100,
                  )}
                  % · {formatAda(p.withdrawalAda)} of ₳{formatAda(nclImpact.remainingAda)} remaining
                </div>
              )}
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Link>
        ))}

        {nclImpact && data.totalAda > 0 && (
          <div className="text-xs text-muted-foreground mt-2 p-2 rounded bg-muted/30">
            If all {data.proposals.length} pending proposals pass: NCL utilization{' '}
            {Math.round(nclImpact.utilizationPct)}% →{' '}
            {Math.round(
              ((nclImpact.nclAda - nclImpact.remainingAda + data.totalAda) / nclImpact.nclAda) *
                100,
            )}
            % (₳{formatAda(nclImpact.nclAda - nclImpact.remainingAda + data.totalAda)} of ₳
            {formatAda(nclImpact.nclAda)})
          </div>
        )}

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
