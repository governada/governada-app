import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LAYER1_REPLAY_WINDOW_HOURS } from '@/lib/globe/layer1Constants';

export type ChainActivityVote = 'Yes' | 'No' | 'Abstain';
export type ChainActivityVoterKind = 'drep' | 'spo' | 'cc';
export type ChainActivityReplayPhase = 'initial' | 'live';

type ChainActivityObservation = {
  observedAtMs?: number;
  replayPhase?: ChainActivityReplayPhase;
};

export type ChainActivityEvent = ChainActivityObservation &
  (
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
      }
  );

export interface ChainActivityReplayResponse {
  events: ChainActivityEvent[];
  windowHours: number;
  generatedAt: string;
}

interface ChainActivityReplayOptions {
  enabled?: boolean;
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
  { enabled = true }: ChainActivityReplayOptions = {},
): ChainActivityEvent[] {
  const seenEventsRef = useRef(new Map<string, ChainActivityObservation>());
  const initialSnapshotSeenRef = useRef(false);

  const attachObservationMetadata = useCallback(
    (response: ChainActivityReplayResponse): ChainActivityReplayResponse => {
      const nowMs = Date.now();
      const currentEventIds = new Set(response.events.map((event) => event.id));

      for (const eventId of seenEventsRef.current.keys()) {
        if (!currentEventIds.has(eventId)) {
          seenEventsRef.current.delete(eventId);
        }
      }

      const isInitialSnapshot = !initialSnapshotSeenRef.current;
      const events = response.events.map((event) => {
        const existing = seenEventsRef.current.get(event.id);
        const observation =
          existing ??
          ({
            observedAtMs: nowMs,
            replayPhase: isInitialSnapshot ? 'initial' : 'live',
          } satisfies ChainActivityObservation);

        seenEventsRef.current.set(event.id, observation);
        return { ...event, ...observation };
      });

      initialSnapshotSeenRef.current = true;
      return { ...response, events };
    },
    [],
  );

  const query = useQuery({
    queryKey: ['chain-activity-replay', windowHours],
    queryFn: () => fetchChainActivityReplay(windowHours),
    enabled,
    select: attachObservationMetadata,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
  });

  return enabled ? (query.data?.events ?? []) : [];
}
