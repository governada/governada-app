'use client';

import { useWallet } from '@/utils/wallet';
import { ProposalOutcomeCard } from '@/components/ProposalOutcomeCard';
import { ProposalOutcomeTracker } from '@/components/governada/proposals/ProposalOutcomeTracker';
import { useProposalOutcome } from '@/hooks/queries';
import type { ProposalOutcome } from '@/lib/proposalOutcomes';

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
  const { data: outcomeData } = useProposalOutcome(proposal.txHash, proposal.proposalIndex);

  const outcome = outcomeData as ProposalOutcome | undefined;

  const drepVote = delegatedDrepId
    ? (votes.find((v) => v.drepId === delegatedDrepId)?.vote ?? null)
    : null;

  const isWinner = drepVote && majorityVote ? drepVote === majorityVote : undefined;

  return (
    <div className="space-y-4">
      <ProposalOutcomeCard
        proposal={proposal}
        drepVote={drepVote}
        isWinner={isWinner}
        deliveryStatus={outcome?.deliveryStatus}
        deliveryScore={outcome?.deliveryScore}
      />
      {/* Show detailed outcome tracker for enacted treasury proposals */}
      {outcome &&
        proposal.outcome === 'enacted' &&
        proposal.proposalType === 'TreasuryWithdrawals' && (
          <ProposalOutcomeTracker outcome={outcome} />
        )}
    </div>
  );
}
