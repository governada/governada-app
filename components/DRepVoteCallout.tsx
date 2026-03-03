'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, MinusCircle, CircleDashed } from 'lucide-react';

interface DRepVoteCalloutProps {
  txHash: string;
  proposalIndex: number;
}

export function DRepVoteCallout({ txHash, proposalIndex }: DRepVoteCalloutProps) {
  const { delegatedDrepId } = useWallet();
  const [vote, setVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!delegatedDrepId) return;
    setLoading(true);
    fetch(`/api/drep/${delegatedDrepId}/votes`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.votes) {
          const match = data.votes.find(
            (v: any) => v.proposalTxHash === txHash && v.proposalIndex === proposalIndex,
          );
          setVote(match?.vote || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [delegatedDrepId, txHash, proposalIndex]);

  if (!delegatedDrepId || loading) return null;

  const config = vote
    ? {
        Yes: {
          icon: CheckCircle2,
          text: 'Your DRep voted Yes',
          bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
        },
        No: {
          icon: XCircle,
          text: 'Your DRep voted No',
          bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
        },
        Abstain: {
          icon: MinusCircle,
          text: 'Your DRep abstained',
          bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
        },
      }[vote] || null
    : null;

  if (config) {
    const Icon = config.icon;
    return (
      <Card className={`${config.bg} border`}>
        <CardContent className="p-3 flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{config.text}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/50 border border-dashed">
      <CardContent className="p-3 flex items-center gap-2">
        <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">
          Your DRep has not voted on this proposal yet
        </span>
      </CardContent>
    </Card>
  );
}
