'use client';

import { useMemo } from 'react';
import { useWallet } from '@/utils/wallet';
import { useDRepVotes } from '@/hooks/queries';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, MinusCircle, CircleDashed } from 'lucide-react';

interface DRepVoteCalloutProps {
  txHash: string;
  proposalIndex: number;
}

export function DRepVoteCallout({ txHash, proposalIndex }: DRepVoteCalloutProps) {
  const { delegatedDrepId } = useWallet();
  const { data: votesData, isLoading } = useDRepVotes(delegatedDrepId);

  const vote = useMemo(() => {
    const votes = (votesData as any)?.votes;
    if (!votes) return null;
    const match = votes.find(
      (v: any) => v.proposalTxHash === txHash && v.proposalIndex === proposalIndex,
    );
    return match?.vote || null;
  }, [votesData, txHash, proposalIndex]);

  if (!delegatedDrepId || isLoading) return null;

  const voteConfigMap: Record<string, { icon: typeof CheckCircle2; text: string; bg: string }> = {
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
  };
  const config = vote ? voteConfigMap[vote as string] ?? null : null;

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
