'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, CheckCircle2, XCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatAda } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';
import { useTreasurySimilar } from '@/hooks/queries';

interface SimilarProposal {
  txHash: string;
  index: number;
  title: string;
  withdrawalAda: number;
  treasuryTier: string | null;
  outcome: string;
  accountabilityRating: string | null;
  matchStrength: string;
}

interface Props {
  txHash: string;
  index: number;
}

const outcomeConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  enacted: { label: 'Enacted', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  ratified: { label: 'Ratified', icon: CheckCircle2, color: 'text-blue-600 dark:text-blue-400' },
  expired: { label: 'Expired', icon: Clock, color: 'text-muted-foreground' },
  dropped: { label: 'Dropped', icon: XCircle, color: 'text-red-500' },
  active: { label: 'Active', icon: AlertCircle, color: 'text-amber-500' },
};

export function SimilarProposalsCard({ txHash, index }: Props) {
  const { data: raw, isLoading } = useTreasurySimilar(txHash, index);
  const similar: SimilarProposal[] = (raw as any)?.similar ?? [];

  useEffect(() => {
    if (similar.length > 0) {
      posthog.capture('similar_proposals_viewed', { count: similar.length });
    }
  }, [similar.length]);

  if (isLoading || similar.length === 0) return null;

  const enacted = similar.filter((s) => s.outcome === 'enacted');
  const delivered = enacted.filter(
    (s) => s.accountabilityRating === 'delivered' || s.accountabilityRating === 'partial',
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Learn From History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {enacted.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{enacted.length}</span> similar proposals
            were approved in the past.
            {delivered.length > 0 && (
              <>
                {' '}
                Community rated{' '}
                <span className="font-medium text-foreground">{delivered.length}</span> as
                delivering.
              </>
            )}
          </p>
        )}

        <div className="space-y-2">
          {similar.map((p) => {
            const config = outcomeConfig[p.outcome] || outcomeConfig.active;
            const Icon = config.icon;
            return (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposals/${p.txHash}/${p.index}`}
                className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
              >
                <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{p.title}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono tabular-nums">{formatAda(p.withdrawalAda)} ADA</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {p.matchStrength} match
                    </Badge>
                    <span className={config.color}>{config.label}</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
