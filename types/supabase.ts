import { UserPrefKey } from './drep';

export interface SupabaseUser {
  id: string;
  wallet_address: string;
  display_name?: string;
  prefs: {
    userPrefs?: UserPrefKey[];
    hasSeenOnboarding?: boolean;
  };
  watchlist: string[];
  delegation_history: DelegationRecord[];
  push_subscriptions: PushSubscriptionData;
  last_active: string;
  claimed_drep_id?: string;
  email?: string;
  email_verified?: boolean;
  digest_frequency?: 'weekly' | 'biweekly' | 'monthly' | 'off';
  governance_depth?: 'hands_off' | 'informed' | 'engaged' | 'deep';
  notification_preferences?: Record<string, boolean>;
}

export interface DelegationRecord {
  drepId: string;
  timestamp: string;
  txHash?: string;
}

export interface PushSubscriptionData {
  endpoint?: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  subscribed_at?: string;
}

export type SupabaseUserUpdate = Partial<Omit<SupabaseUser, 'id' | 'wallet_address'>>;

export interface PollResponse {
  id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  user_id: string;
  wallet_address: string;
  stake_address: string | null;
  delegated_drep_id: string | null;
  vote: 'yes' | 'no' | 'abstain';
  initial_vote: 'yes' | 'no' | 'abstain';
  created_at: string;
  updated_at: string;
  vote_count: number;
}

export interface PollResultsResponse {
  community: { yes: number; no: number; abstain: number; total: number };
  delegators?: { yes: number; no: number; abstain: number; total: number };
  userVote: 'yes' | 'no' | 'abstain' | null;
  hasVoted: boolean;
}
