export interface ProposalItem {
  txHash: string;
  index: number;
  title: string;
  proposalType?: string;
  epochsRemaining?: number;
}

export interface VoteItem {
  vote?: string;
  voteDirection?: string;
  hasRationale?: boolean;
  rationale?: string;
  proposalTxHash?: string;
  proposalIndex?: number;
  proposalTitle?: string;
  title?: string;
  proposalType?: string;
}

export interface PulseData {
  activeProposals?: number;
  criticalProposals?: number;
  currentEpoch?: number;
  daysRemaining?: number;
  participationRate?: number;
  activeDReps?: number;
  governanceHealthIndex?: number;
  communityGap?: CommunityGapItem[];
  [key: string]: unknown;
}

export interface CommunityGapItem {
  txHash: string;
  index: number;
  title: string;
  gap: number;
  communityYesPct: number;
  drepVote: string;
  pollTotal?: number;
  pollYes?: number;
  pollNo?: number;
  drepVotePct?: number;
}

export interface UrgentData {
  proposals?: ProposalItem[];
  unexplainedVotes?: Record<string, unknown>[];
  pendingProposals?: ProposalItem[];
  pendingCount?: number;
  hasGovernanceStatement?: boolean;
  unansweredQuestions?: number;
}

export interface CompetitiveNeighbor {
  drepId?: string;
  poolId?: string;
  name?: string;
  ticker?: string;
  poolName?: string;
  rank?: number;
  score?: number;
  isTarget?: boolean;
}

export interface CompetitiveData {
  rank?: number;
  totalActive?: number;
  totalPools?: number;
  nearbyAbove?: CompetitiveNeighbor[];
  nearbyBelow?: CompetitiveNeighbor[];
  neighbors?: CompetitiveNeighbor[];
  top10FocusArea?: { pillar: string; gap: number } | null;
  distanceToTop10?: number;
  scoreHistory?: { epoch_no: number; governance_score: number }[];
}

export interface DRepReportCardData {
  score?: number;
  tier?: string;
  isActive?: boolean;
  delegatorCount?: number;
  momentum?: number;
  rationaleRate?: number;
  participationRate?: number;
  tierProgress?: {
    pointsToNext?: number;
    nextTier?: string;
    currentTier?: string;
    percentWithinTier?: number;
  };
  pillars?: Record<string, number>;
  alignment?: Record<string, number>;
  scoreHistory?: { snapshot_date: string; score: number }[];
  votingRecord?: {
    rationaleRate?: number;
    totalVotes?: number;
    rationalesProvided?: number;
  };
}

export interface VotesResponseData {
  votes?: VoteItem[];
  totalVotes?: number;
}

export interface TreasuryData {
  balanceAda?: number;
  inflowAda?: number;
  outflowAda?: number;
  netFlowAda?: number;
  pendingWithdrawals?: number;
  pendingAmountAda?: number;
  health?: number;
  healthLabel?: string;
  healthComponents?: TreasuryHealthComponent[];
  [key: string]: unknown;
}

export interface TreasuryHealthComponent {
  label?: string;
  name?: string;
  score?: number;
  value?: number;
  weight?: number;
}

export interface LeaderboardEntry {
  id?: string;
  drepId?: string;
  poolId?: string;
  name?: string;
  ticker?: string;
  score?: number;
  currentScore?: number;
  tier?: string;
  delegatorCount?: number;
  votingPowerLovelace?: string;
  rank?: number;
  previousRank?: number;
  momentum?: number;
  delta?: number;
  info?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HallOfFameEntry {
  drepId: string;
  name: string;
  score: number;
  days: number;
}

export interface LeaderboardData {
  leaderboard?: LeaderboardEntry[];
  weeklyMovers?: {
    gainers?: LeaderboardEntry[];
    losers?: LeaderboardEntry[];
  };
  hallOfFame?: HallOfFameEntry[];
  totalActive?: number;
  averageScore?: number;
  [key: string]: unknown;
}

export interface GovernanceSummaryData {
  activeDReps?: number;
  activeProposals?: number;
  participationRate?: number;
  averageScore?: number;
  totalVotingPower?: string;
  currentEpoch?: number;
  epochProgress?: number;
  daysRemaining?: number;
  governanceHealthIndex?: number;
  healthTrend?: string;
  networkSentiment?: string;
  [key: string]: unknown;
}

export interface ConstellationNode {
  id: string;
  name?: string;
  ticker?: string;
  score?: number;
  x: number;
  y: number;
  tier?: string;
  cluster?: string;
  delegatorCount?: number;
  votingPower?: number;
}

export interface ConstellationEdge {
  source: string;
  target: string;
  weight?: number;
}

export interface ConstellationData {
  nodes?: ConstellationNode[];
  edges?: ConstellationEdge[];
  clusters?: Record<string, unknown>[];
}

export interface CalendarEvent {
  id?: string;
  title: string;
  date: string;
  type: string;
  description?: string;
  txHash?: string;
  index?: number;
  epochsRemaining?: number;
  proposalType?: string;
}

export interface CalendarData {
  events?: CalendarEvent[];
  currentEpoch?: number;
  epochEndDate?: string;
  [key: string]: unknown;
}

export interface InboxItem {
  id: string;
  type: string;
  title: string;
  message?: string;
  timestamp?: string;
  read?: boolean;
  actionUrl?: string;
  txHash?: string;
  index?: number;
  [key: string]: unknown;
}

export interface CitizenDashboardData {
  delegatedDrep?: string;
  delegatedDrepName?: string;
  delegatedDrepScore?: number;
  delegatedDrepTier?: string;
  stakeAddress?: string;
  votingPower?: string;
  [key: string]: unknown;
}

export interface SPOSummaryData {
  spoScore?: number;
  score?: number;
  tier?: string;
  isClaimed?: boolean;
  claimed?: boolean;
  name?: string;
  ticker?: string;
  delegatorCount?: number;
  scoreDelta?: number;
  weeklyDelta?: number;
  participationRate?: number;
  rationaleRate?: number;
  deliberationQuality?: number;
  reliabilityRate?: number;
  governanceIdentity?: number;
  voteCount?: number;
  alignment?: Record<string, number>;
  interBodyAlignment?: { drepConsensus?: number; ccConsensus?: number };
}

export interface GHIHistoryEntry {
  epoch: number;
  score: number;
  components?: Record<string, number>;
}

export interface GHIData {
  current?: number;
  history?: GHIHistoryEntry[];
  components?: Record<string, number>;
  [key: string]: unknown;
}

export interface BenchmarkData {
  benchmarks?: Record<string, { value: number; label?: string; trend?: string }>;
  [key: string]: unknown;
}

export interface DecentralizationData {
  nakamatoCoefficient?: number;
  gini?: number;
  topDRepPowerPct?: number;
  topDRepCount?: number;
  activeDReps?: number;
  [key: string]: unknown;
}

export interface InterBodyData {
  drepVsPool?: number;
  drepVsCc?: number;
  poolVsCc?: number;
  [key: string]: unknown;
}

export interface GovernanceTrendsData {
  epochs?: number[];
  participationRates?: number[];
  averageScores?: number[];
  activeDReps?: number[];
  proposalCounts?: number[];
  [key: string]: unknown;
}

export interface StateOfGovernanceSection {
  title?: string;
  score?: number;
  trend?: string;
  highlights?: string[];
  [key: string]: unknown;
}

export interface EpochBriefingData {
  epoch?: number;
  headline?: string;
  summary?: string;
  highlights?: { label: string; value: string; trend?: string }[];
  keyProposals?: ProposalItem[];
  [key: string]: unknown;
}

export interface SimilarDRepItem {
  drepId: string;
  name?: string;
  similarity: number;
  score?: number;
  tier?: string;
  sharedDimensions?: string[];
}
