'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TimelineSkeleton } from '@/components/ui/content-skeletons';
import { History, ArrowDown, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { formatAda } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';

interface EnactedProposal {
  tx_hash: string;
  proposal_index: number;
  title: string;
  withdrawal_amount: number;
  treasury_tier: string | null;
  enacted_epoch: number;
}

export function TreasuryHistoryTimeline() {
  const [proposals, setProposals] = useState<EnactedProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, withdrawal_amount, treasury_tier, enacted_epoch')
      .eq('proposal_type', 'TreasuryWithdrawals')
      .not('enacted_epoch', 'is', null)
      .order('enacted_epoch', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setProposals((data as EnactedProposal[]) || []);
        setLoading(false);
        if (data?.length) {
          posthog.capture('treasury_history_viewed', { enacted_count: data.length });
        }
      });
  }, []);

  if (loading) return <TimelineSkeleton count={4} />;
  if (!proposals.length) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No enacted treasury withdrawals recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  const grouped = proposals.reduce<Record<number, EnactedProposal[]>>((acc, p) => {
    const key = p.enacted_epoch;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const tierColors: Record<string, string> = {
    routine: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    significant: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    major: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const cumulativeTotal = proposals.reduce((s, p) => s + (p.withdrawal_amount || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Treasury Withdrawal History
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            Total:{' '}
            <span className="font-semibold text-foreground">{formatAda(cumulativeTotal)} ADA</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          {Object.entries(grouped)
            .sort(([a], [b]) => parseInt(b) - parseInt(a))
            .map(([epoch, items]) => {
              const epochTotal = items.reduce((s, p) => s + (p.withdrawal_amount || 0), 0);
              return (
                <div key={epoch} className="relative pl-10 pb-6 last:pb-0">
                  <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold">Epoch {epoch}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatAda(epochTotal)} ADA
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {items.map((p) => (
                      <Link
                        key={`${p.tx_hash}-${p.proposal_index}`}
                        href={`/proposals/${p.tx_hash}/${p.proposal_index}`}
                        className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="truncate flex-1">{p.title || 'Untitled'}</span>
                        {p.treasury_tier && (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${tierColors[p.treasury_tier] || ''}`}
                          >
                            {p.treasury_tier}
                          </Badge>
                        )}
                        <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                          {formatAda(p.withdrawal_amount || 0)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
