import { useQuery } from '@tanstack/react-query';
import { LAYER1_REPLAY_WINDOW_HOURS } from '@/lib/globe/layer1Constants';

export type ChainActivityVote = 'Yes' | 'No' | 'Abstain';
export type ChainActivityVoterKind = 'drep' | 'spo' | 'cc';

export type ChainActivityEvent =
  | {
      type: 'vote_cast';
      id: string;
      timestamp: number;
      voterKind: ChainActivityVoterKind;
      voterNodeId: string;
      voterFullId: string;
      voterIdentityColor: string;
      proposalNodeId: string;
      proposalKey: string;
      proposalTitle: string | null;
      vote: ChainActivityVote;
      influenceLovelace: number | null;
    }
  | {
      type: 'rationale_published';
      id: string;
      timestamp: number;
      drepNodeId: string;
      drepFullId: string;
      drepIdentityColor: string;
      proposalNodeId: string | null;
      proposalKey: string | null;
      voteTxHash: string;
    }
  | {
      type: 'proposal_voting_window_progress';
      id: string;
      timestamp: number;
      proposalNodeId: string;
      proposalKey: string;
      proposalTitle: string | null;
      progress: number;
    }
  | {
      type: 'treasury_proposal_amber';
      id: string;
      timestamp: number;
      proposalNodeId: string;
      proposalKey: string;
      proposalTitle: string | null;
      withdrawalAmountLovelace: number;
      amberSaturation: number;
    };

export interface ChainActivityReplayResponse {
  events: ChainActivityEvent[];
  windowHours: number;
  generatedAt: string;
}

async function fetchChainActivityReplay(windowHours: number): Promise<ChainActivityReplayResponse> {
  const params = new URLSearchParams({ hours: String(windowHours) });
  const res = await fetch(`/api/chain/activity-replay?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch chain activity replay: ${res.status}`);
  }

  return res.json() as Promise<ChainActivityReplayResponse>;
}

export function useChainActivityReplay(
  windowHours: number = LAYER1_REPLAY_WINDOW_HOURS,
): ChainActivityEvent[] {
  const query = useQuery({
    queryKey: ['chain-activity-replay', windowHours],
    queryFn: () => fetchChainActivityReplay(windowHours),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return query.data?.events ?? [];
}
