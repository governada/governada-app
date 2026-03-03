'use client';

import { useWallet } from '@/utils/wallet';
import { ProposalOutcomeCard } from '@/components/ProposalOutcomeCard';

type Outcome = 'ratified' | 'enacted' | 'dropped' | 'expired';

interface Props {
  proposal: {
    txHash: string;
    proposalIndex: number;
    title: string;
    proposalType: string;
    withdrawalAmount?: number | null;
    outcome: Outcome;
  };
  votes: { drepId: string; vote: string }[];
  majorityVote: string | null;
}

export function ProposalOutcomeSection({ proposal, votes, majorityVote }: Props) {
  const { delegatedDrepId } = useWallet();

  const drepVote = delegatedDrepId
    ? (votes.find((v) => v.drepId === delegatedDrepId)?.vote ?? null)
    : null;

  const isWinner = drepVote && majorityVote ? drepVote === majorityVote : undefined;

  return <ProposalOutcomeCard proposal={proposal} drepVote={drepVote} isWinner={isWinner} />;
}
