/**
 * Reconciliation Engine — Types
 *
 * Cross-reference Governada's Supabase data against independent Cardano
 * data providers (Blockfrost) to detect discrepancies.
 */

// ---------------------------------------------------------------------------
// Check result types
// ---------------------------------------------------------------------------

export type CheckStatus = 'match' | 'drift' | 'mismatch';

export interface CheckResult {
  /** Human-readable metric name */
  metric: string;
  /** Which tier this check belongs to */
  tier: 1 | 2;
  /** Our value */
  ours: number | string | string[];
  /** Cross-reference value */
  theirs: number | string | string[];
  /** Result of comparison */
  status: CheckStatus;
  /** If drift/mismatch, description of difference */
  detail?: string;
  /** Tolerance applied for this check */
  tolerance?: string;
}

export interface ReconciliationReport {
  /** When the check was performed */
  checkedAt: string;
  /** Cross-reference source */
  source: 'blockfrost';
  /** Worst status across all checks */
  overallStatus: CheckStatus;
  /** Per-metric results */
  results: CheckResult[];
  /** Subset of results that are drift or mismatch */
  mismatches: CheckResult[];
  /** How long the check took */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Blockfrost API response types (governance-specific)
// ---------------------------------------------------------------------------

export interface BlockfrostDRep {
  drep_id: string;
  hex: string;
  amount: string;
  active: boolean;
  active_epoch: number | null;
  has_script: boolean;
  retired: boolean | null;
  expired: boolean | null;
}

export interface BlockfrostProposal {
  tx_hash: string;
  cert_index: number;
  governance_type: string;
  /** null when still open */
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
}

export interface BlockfrostEpoch {
  epoch: number;
  start_time: number;
  end_time: number;
  first_block_time: number;
  last_block_time: number;
  block_count: number;
  tx_count: number;
  output: string;
  fees: string;
  active_stake: string | null;
}

export interface BlockfrostNetwork {
  supply: {
    max: string;
    total: string;
    circulating: string;
    locked: string;
    treasury: string;
    reserves: string;
  };
  stake: {
    live: string;
    active: string;
  };
}

export interface BlockfrostCommitteeMember {
  hot_key: string | null;
  cold_key: string;
  status: string;
  start_epoch: number;
  expiration_epoch: number;
}

export interface BlockfrostCommittee {
  era: string | null;
  epoch: number;
  members: BlockfrostCommitteeMember[];
}

export interface BlockfrostProposalVotes {
  tx_hash: string;
  cert_index: number;
  voter_hash: string;
  voter_role: string;
  vote: string;
}

// ---------------------------------------------------------------------------
// Tolerance configuration
// ---------------------------------------------------------------------------

export interface ToleranceConfig {
  /** Absolute count tolerance (e.g., ±5 means within 5 of each other) */
  countAbsolute?: number;
  /** Percentage tolerance for large numbers (e.g., 0.01 = 1%) */
  percentRelative?: number;
  /** For set comparisons, how many items can differ */
  setDiffMax?: number;
}

/** Default tolerances per metric type */
export const DEFAULT_TOLERANCES: Record<string, ToleranceConfig> = {
  // Tier 1: aggregate counts
  drepCount: { countAbsolute: 5, percentRelative: 0.02 },
  proposalCount: { countAbsolute: 2 },
  ccMembers: { setDiffMax: 0 }, // exact match
  epoch: { countAbsolute: 0 }, // exact match
  treasuryBalance: { percentRelative: 0.001 }, // 0.1%
  // Tier 2: per-entity checks
  voteCounts: { countAbsolute: 3 },
  votingPower: { percentRelative: 0.01 }, // 1%
  drepStatus: { countAbsolute: 0 }, // exact
  proposalLifecycle: { countAbsolute: 0 }, // exact
  spoVoteCount: { countAbsolute: 5, percentRelative: 0.03 },
};
