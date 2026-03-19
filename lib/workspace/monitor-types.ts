/**
 * Types for the Proposal Monitoring Dashboard.
 *
 * Shared between the API route and frontend components.
 */

// ---------------------------------------------------------------------------
// Voting tally per governance body
// ---------------------------------------------------------------------------

export interface VotingBodyTally {
  yesCount: number;
  yesVotePower: number;
  noCount: number;
  noVotePower: number;
  abstainCount: number;
  abstainVotePower: number;
  /** Threshold ratio (0-1) required for this body to pass */
  threshold: number;
}

export interface CCTally {
  yesCount: number;
  noCount: number;
  abstainCount: number;
  /** Threshold ratio (0-1) required for CC to pass */
  threshold: number;
}

// ---------------------------------------------------------------------------
// Recent vote activity
// ---------------------------------------------------------------------------

export interface RecentVote {
  voterId: string;
  voterType: 'drep' | 'spo' | 'cc';
  vote: 'Yes' | 'No' | 'Abstain';
  epochNo: number;
  hasRationale: boolean;
}

// ---------------------------------------------------------------------------
// Deposit tracking
// ---------------------------------------------------------------------------

export interface DepositInfo {
  /** Deposit amount in lovelace */
  amount: number;
  status: 'locked' | 'returned' | 'at_risk';
  returnAddress: string | null;
}

// ---------------------------------------------------------------------------
// Full monitoring response
// ---------------------------------------------------------------------------

export interface ProposalMonitorData {
  // Identity
  txHash: string;
  proposalIndex: number;
  title: string;
  proposalType: string;

  // Lifecycle status
  status: 'voting' | 'ratified' | 'enacted' | 'expired' | 'dropped';
  proposedEpoch: number | null;
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  expiredEpoch: number | null;
  droppedEpoch: number | null;
  expirationEpoch: number | null;

  // Voting tallies
  voting: {
    drep: VotingBodyTally;
    spo?: VotingBodyTally;
    cc?: CCTally;
  };

  // Recent vote activity
  recentVotes: RecentVote[];

  // Deposit
  deposit: DepositInfo;

  // Epochs
  currentEpoch: number;
  epochsRemaining: number | null;
}
