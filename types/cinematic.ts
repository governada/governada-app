import type { UserSegment } from '@/components/providers/SegmentProvider';

export const CINEMATIC_STATES = [
  'first_visit_anonymous',
  'first_visit_wallet_connected',
  'returning_in_session',
  'returning_quiet',
  'returning_significant_delta',
  'returning_epoch',
  'returning_cold_start',
  'civic_event_tier_0',
  'action_required',
  'sentiment_opportunity',
] as const;

export type CinematicState = (typeof CINEMATIC_STATES)[number];
export type PrioritizedTier = 0 | 1 | 2;
export type PrioritizedKind = 'crisp' | 'soft' | 'informational';

export interface PrioritizedItem<Payload = unknown> {
  id: string;
  tier: PrioritizedTier;
  kind: PrioritizedKind;
  state: CinematicState;
  surfaced_at: string;
  acknowledged_at?: string;
  dismissed_at?: string;
  completed_at?: string;
  payload: Payload;
}

export interface PrioritizedQueue {
  primary: PrioritizedItem;
  secondary: PrioritizedItem[];
  meta: {
    reasoning: string;
    generatedAt: string;
  };
}

export type Tier0TriggerType =
  | 'constitutional_amendment_ratified'
  | 'hard_fork_enacted'
  | 'no_confidence_ratified'
  | 'major_treasury_withdrawal_closed';

export interface Tier0Trigger {
  id: string;
  type: Tier0TriggerType;
  proposalTxHash: string;
  proposalIndex: number;
  proposalType: string;
  title?: string | null;
  eventEpoch: number;
  decayHours: number;
  withdrawalAmountAda?: number;
}

export interface PrioritizationAcknowledgment {
  item_id: string;
  acknowledged_at: string | null;
  dismissed_at: string | null;
}

export interface VisitState {
  lastVisitAt: string | null;
  priorVisitAt: string | null;
  priorEpochVisited?: number | null;
}

export interface UserCinematicContext {
  segment: UserSegment;
  stakeAddress?: string | null;
  userId?: string | null;
  drepId?: string | null;
  poolId?: string | null;
  ccHotId?: string | null;
  delegatedDrepId?: string | null;
  claimedDrepId?: string | null;
  hasConnectedWallet?: boolean;
  isFirstWalletVisit?: boolean;
  isInSessionReturn?: boolean;
  isColdStart?: boolean;
  currentEpoch?: number;
  lastEpochVisited?: number | null;
  scoreMomentum?: number | null;
  driftClassification?: string | null;
  missedVotesCount?: number | null;
  visitState?: VisitState | null;
  acknowledgments?: PrioritizationAcknowledgment[];
}

export interface GovernanceDelta {
  id: string;
  label?: string;
  scoreMomentum?: number | null;
  driftClassification?: string | null;
  missedVotesCount?: number | null;
  magnitude?: number;
}

export interface GovernanceProposalSignal {
  id: string;
  title?: string | null;
  proposalType?: string | null;
  txHash?: string | null;
  proposalIndex?: number | null;
  expirationEpoch?: number | null;
}

export interface GovernanceCinematicContext {
  tier0Triggers?: Tier0Trigger[];
  deltas?: GovernanceDelta[];
  actionItems?: PrioritizedItem[];
  sentimentOpportunities?: GovernanceProposalSignal[];
  now?: string | Date;
}
