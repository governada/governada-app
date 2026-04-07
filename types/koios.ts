/**
 * Koios API Response Types
 * Documentation: https://api.koios.rest/
 */

// Base types
export interface KoiosResponse<T> {
  data?: T;
  error?: string;
}

// DRep List Response
export interface DRepListItem {
  drep_id: string;
  drep_hash: string;
  hex: string;
  has_script: boolean;
  registered: boolean;
}

export type DRepListResponse = DRepListItem[];

// DRep Info Response
export interface DRepInfo {
  drep_id: string;
  drep_hash: string;
  hex: string;
  has_script: boolean;
  registered: boolean;
  deposit: string | null;
  anchor_url: string | null;
  anchor_hash: string | null;
  amount: string; // Total voting power in lovelace
  active_epoch: number | null;
}

export type DRepInfoResponse = DRepInfo[];

// DRep Metadata Response
export interface DRepMetadata {
  drep_id: string;
  hex: string;
  has_script: boolean;
  meta_url: string | null;
  meta_hash: string | null;
  meta_json: {
    name?: string;
    ticker?: string;
    description?: string;
    body?: {
      // CIP-119 Governance Metadata Fields
      givenName?: string;
      objectives?: string;
      motivations?: string;
      qualifications?: string;
      paymentAddress?: string;
      // Legacy/Additional Fields
      bio?: string;
      email?: string;
      references?: Array<{
        label: string;
        uri: string;
      }>;
      [key: string]: unknown;
    };
    authors?: string[];
    [key: string]: unknown;
  } | null;
  bytes: string | null;
  warning: string | null;
  language: string | null;
  comment: string | null;
  is_valid: boolean | null;
}

export type DRepMetadataResponse = DRepMetadata[];

// DRep Votes Response (Governance Actions)
export interface DRepVote {
  proposal_tx_hash: string;
  proposal_index: number;
  vote_tx_hash: string;
  block_time: number;
  vote: 'Yes' | 'No' | 'Abstain';
  meta_url: string | null;
  meta_hash: string | null;
  meta_json: {
    // CIP-100 nests rationale under body.comment or body.rationale
    body?: {
      comment?: string;
      rationale?: string;
      motivation?: string;
      [key: string]: unknown;
    };
    // Flat format fallback
    title?: string;
    abstract?: string;
    motivation?: string;
    rationale?: string;
    [key: string]: unknown;
  } | null;
  epoch_no?: number;
  has_rationale?: boolean;
}

export type DRepVotesResponse = DRepVote[];

// Proposal Info (for governance actions from /proposal_list)
export interface ProposalInfo {
  proposal_tx_hash: string;
  proposal_index: number;
  proposal_id: string; // CIP-129 bech32 gov_action1... format
  proposal_type:
    | 'TreasuryWithdrawals'
    | 'ParameterChange'
    | 'HardForkInitiation'
    | 'InfoAction'
    | 'NoConfidence'
    | 'NewCommittee'
    | 'NewConstitution'
    | 'NewConstitutionalCommittee'
    | 'UpdateConstitution';
  proposal_description: string | null;
  deposit: string;
  return_address: string;
  proposed_epoch: number;
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
  expiration: number | null;
  meta_url: string | null;
  meta_hash: string | null;
  meta_json: {
    // CIP-108 nests content under `body`
    body?: {
      title?: string;
      abstract?: string;
      motivation?: string;
      rationale?: string;
      references?: Array<{ uri?: string; label?: string; '@type'?: string }>;
      [key: string]: unknown;
    };
    // Flat fallback (older proposals)
    title?: string;
    abstract?: string;
    motivation?: string;
    rationale?: string;
    [key: string]: unknown;
  } | null;
  meta_comment: string | null;
  meta_is_valid: boolean | null;
  withdrawal:
    | {
        stake_address: string;
        amount: string;
      }[]
    | null;
  param_proposal: Record<string, unknown> | null;
  block_time: number;
}

export type ProposalListResponse = ProposalInfo[];

// Classified proposal (after processing)
export interface ClassifiedProposal {
  txHash: string;
  index: number;
  proposalId: string; // CIP-129 bech32
  type: ProposalInfo['proposal_type'];
  title: string;
  abstract: string | null;
  withdrawalAmountAda: number | null;
  treasuryTier: 'routine' | 'significant' | 'major' | null;
  paramChanges: Record<string, unknown> | null;
  relevantPrefs: string[];
  proposedEpoch: number;
  blockTime: number;
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
  expirationEpoch: number | null;
}

// SPO Vote (from /vote_list?voter_role=eq.SPO)
export interface SPOVote {
  pool_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: 'Yes' | 'No' | 'Abstain';
  block_time: number;
  tx_hash: string;
  epoch: number;
}

// Constitutional Committee Vote (from /vote_list?voter_role=eq.ConstitutionalCommittee)
export interface CCVote {
  cc_hot_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: 'Yes' | 'No' | 'Abstain';
  block_time: number;
  tx_hash: string;
  epoch: number;
  meta_url: string | null;
  meta_hash: string | null;
}

// Koios account_info response fields we consume
export interface KoiosAccountInfo {
  stake_address: string;
  status: string;
  delegated_pool: string | null;
  total_balance: string;
  utxo: string;
  rewards_available: string;
  vote_delegation: string | null;
}

// Canonical voting summary from Koios /proposal_voting_summary
export interface ProposalVotingSummaryData {
  proposal_type: string;
  epoch_no: number;
  drep_yes_votes_cast: number;
  drep_active_yes_vote_power: string;
  drep_yes_vote_power: string;
  drep_yes_pct: number;
  drep_no_votes_cast: number;
  drep_active_no_vote_power: string;
  drep_no_vote_power: string;
  drep_no_pct: number;
  drep_abstain_votes_cast: number;
  drep_active_abstain_vote_power: string;
  drep_always_no_confidence_vote_power: string;
  drep_always_abstain_vote_power: string;
  pool_yes_votes_cast: number;
  pool_active_yes_vote_power: string;
  pool_yes_vote_power: string;
  pool_yes_pct: number;
  pool_no_votes_cast: number;
  pool_active_no_vote_power: string;
  pool_no_vote_power: string;
  pool_no_pct: number;
  pool_abstain_votes_cast: number;
  pool_active_abstain_vote_power: string;
  committee_yes_votes_cast: number;
  committee_yes_pct: number;
  committee_no_votes_cast: number;
  committee_no_pct: number;
  committee_abstain_votes_cast: number;
}
