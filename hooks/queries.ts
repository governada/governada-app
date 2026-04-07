'use client';

import { useQuery } from '@tanstack/react-query';
import type { NclUtilization, DRepNclImpact } from '@/lib/treasury';
import { fetchJson } from '@/lib/api/client';

export interface CCHealthSummaryResponse {
  status: 'healthy' | 'attention' | 'critical';
  narrative: string;
  trend: 'improving' | 'stable' | 'declining';
  activeMembers: number;
  totalMembers: number;
  avgFidelity: number | null;
  tensionCount: number;
  improvementAreas?: string[];
}

export interface CCCommitteeStats {
  totalProposalsReviewed: number;
  avgRationaleRate: number | null;
  totalCCVotes: number;
}

export interface CommitteeMemberQuickView {
  ccHotId: string;
  name: string | null;
  fidelityGrade: string | null;
  fidelityScore: number | null;
  voteCount: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  approvalRate: number;
  rank: number | null;
  narrativeVerdict: string | null;
}

// Constitutional Intelligence types for committee endpoint

export interface CCAgreementMatrixEntry {
  memberA: string;
  memberB: string;
  voteAgreementPct: number;
  reasoningSimilarityPct: number;
  totalSharedProposals: number;
}

export interface CCBloc {
  label: string;
  members: { ccHotId: string; name: string | null }[];
  internalAgreementPct: number;
}

export interface CCArchetype {
  ccHotId: string;
  label: string;
  description: string | null;
  mostAlignedMember: string | null;
  mostAlignedPct: number | null;
  mostDivergentMember: string | null;
  mostDivergentPct: number | null;
}

export interface CCBriefing {
  headline: string;
  executiveSummary: string;
  keyFindings: { finding: string; severity: string }[];
  whatChanged: string | null;
}

export interface CommitteeResponse {
  members: CommitteeMemberQuickView[];
  health: CCHealthSummaryResponse;
  stats: CCCommitteeStats;
  agreementMatrix: CCAgreementMatrixEntry[];
  blocs: CCBloc[];
  archetypes: CCArchetype[];
  briefing: CCBriefing | null;
}

export function useCommitteeMembers(enabled = true) {
  return useQuery<CommitteeResponse>({
    queryKey: ['cc-members'],
    queryFn: () => fetchJson('/api/governance/committee'),
    enabled,
    staleTime: 120_000,
  });
}

export function useGovernanceHolder(stakeAddress?: string | null) {
  return useQuery({
    queryKey: ['governance-holder', stakeAddress],
    queryFn: () =>
      fetchJson(
        stakeAddress
          ? `/api/governance/holder?stakeAddress=${encodeURIComponent(stakeAddress)}`
          : '/api/governance/holder',
      ),
    enabled: stakeAddress !== undefined,
    staleTime: 120_000,
  });
}

export function useGovernanceSummary(drepId?: string | null) {
  return useQuery({
    queryKey: ['governance-summary', drepId],
    queryFn: () =>
      fetchJson(
        drepId
          ? `/api/governance/summary?drepId=${encodeURIComponent(drepId)}`
          : '/api/governance/summary',
      ),
    staleTime: 5 * 60_000,
  });
}

export function useGovernanceHealthIndex(epochs = 20) {
  return useQuery({
    queryKey: ['ghi-history', epochs],
    queryFn: () => fetchJson(`/api/governance/health-index/history?epochs=${epochs}`),
    staleTime: 10 * 60_000,
  });
}

export function useEpochSummary(wallet: string | undefined, epoch?: number) {
  return useQuery({
    queryKey: ['epoch-summary', wallet, epoch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (wallet) params.set('wallet', wallet);
      if (epoch) params.set('epoch', String(epoch));
      const res = await fetch(`/api/user/epoch-summary?${params}`);
      if (!res.ok) throw new Error('Failed to fetch epoch summary');
      return res.json();
    },
    enabled: !!wallet,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGovernanceTimeline() {
  return useQuery({
    queryKey: ['governance-timeline'],
    queryFn: () => fetchJson('/api/governance/timeline'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceBenchmarks() {
  return useQuery({
    queryKey: ['governance-benchmarks'],
    queryFn: () => fetchJson('/api/governance/benchmarks'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceSparklines() {
  return useQuery({
    queryKey: ['governance-sparklines'],
    queryFn: () => fetchJson('/api/governance/sparklines'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceInsights() {
  return useQuery({
    queryKey: ['governance-insights'],
    queryFn: () => fetchJson('/api/governance/insights'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceActivity(limit = 20) {
  return useQuery({
    queryKey: ['governance-activity', limit],
    queryFn: () => fetchJson(`/api/governance/activity?limit=${limit}`),
    staleTime: 5 * 60_000,
  });
}

export function useGovernanceLeaderboard(tier?: string) {
  return useQuery({
    queryKey: ['governance-leaderboard', tier],
    queryFn: () =>
      fetchJson(tier ? `/api/governance/leaderboard?tier=${tier}` : '/api/governance/leaderboard'),
    staleTime: 5 * 60_000,
  });
}

export function useDRepVotes(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['drep-votes', drepId],
    queryFn: () => fetchJson(`/api/drep/${drepId}/votes`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export function useDRepRationales(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['drep-rationales', drepId],
    queryFn: () => fetchJson(`/api/drep/${drepId}/rationales`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export function useDRepTrajectory(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['drep-trajectory', drepId],
    queryFn: () => fetchJson(`/api/drep/${drepId}/trajectory`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export function useDReps(limit?: number, enabled = true) {
  return useQuery({
    queryKey: ['dreps', limit],
    queryFn: () => fetchJson(limit ? `/api/dreps?limit=${limit}` : '/api/dreps'),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useProposals(limit?: number, enabled = true) {
  return useQuery({
    queryKey: ['proposals', limit],
    queryFn: () => fetchJson(limit ? `/api/proposals?limit=${limit}` : '/api/proposals'),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useSimilarProposals(txHash: string, index: number) {
  return useQuery({
    queryKey: ['similar-proposals', txHash, index],
    queryFn: () =>
      fetchJson(`/api/proposals/similar?tx=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
    staleTime: 10 * 60_000,
  });
}

export function useProposalPower(txHash: string, index: number, type?: string) {
  return useQuery({
    queryKey: ['proposal-power', txHash, index, type],
    queryFn: () =>
      fetchJson(
        `/api/proposals/power?txHash=${encodeURIComponent(txHash)}&index=${index}${type ? `&type=${type}` : ''}`,
      ),
    enabled: !!txHash,
    staleTime: 5 * 60_000,
  });
}

export function useTreasuryCurrent() {
  return useQuery({
    queryKey: ['treasury-current'],
    queryFn: () => fetchJson('/api/treasury/current'),
    staleTime: 10 * 60_000,
  });
}

export function useTreasuryAccountability(txHash?: string, index?: number) {
  return useQuery({
    queryKey: ['treasury-accountability', txHash, index],
    queryFn: () =>
      fetchJson(
        txHash
          ? `/api/treasury/accountability?txHash=${encodeURIComponent(txHash)}&index=${index}`
          : '/api/treasury/accountability',
      ),
    staleTime: 10 * 60_000,
  });
}

export function useTreasuryPending() {
  return useQuery({
    queryKey: ['treasury-pending'],
    queryFn: () => fetchJson('/api/treasury/pending'),
    staleTime: 5 * 60_000,
  });
}

export function useTreasuryHistory(epochs = 30) {
  return useQuery({
    queryKey: ['treasury-history', epochs],
    queryFn: () => fetchJson(`/api/treasury/history?epochs=${epochs}`),
    staleTime: 10 * 60_000,
  });
}

export function useTreasurySimulate(burnAdjust: number) {
  return useQuery({
    queryKey: ['treasury-simulate', burnAdjust],
    queryFn: () => fetchJson(`/api/treasury/simulate?burnAdjust=${burnAdjust}`),
    staleTime: 10 * 60_000,
  });
}

export function useTreasurySimilar(txHash: string, index: number) {
  return useQuery({
    queryKey: ['treasury-similar', txHash, index],
    queryFn: () =>
      fetchJson(`/api/treasury/similar?txHash=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
    staleTime: 10 * 60_000,
  });
}

export function useTreasuryNcl() {
  return useQuery({
    queryKey: ['treasury-ncl'],
    queryFn: () => fetchJson<{ ncl: NclUtilization | null }>('/api/treasury/ncl'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDRepNclImpact(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['drep-ncl-impact', drepId],
    queryFn: () =>
      fetchJson<{ impact: DRepNclImpact | null }>(
        `/api/treasury/drep-ncl?drepId=${encodeURIComponent(drepId!)}`,
      ),
    enabled: !!drepId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardUrgent(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-urgent', drepId],
    queryFn: () => fetchJson(`/api/dashboard/urgent?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 120_000,
  });
}

export function useDashboardRepresentation(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-representation', drepId],
    queryFn: () => fetchJson(`/api/dashboard/representation?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 120_000,
  });
}

export function useDashboardScoreChange(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-score-change', drepId],
    queryFn: () => fetchJson(`/api/dashboard/score-change?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export function useDashboardDelegatorTrends(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-delegator-trends', drepId],
    queryFn: () =>
      fetchJson(`/api/dashboard/delegator-trends?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export function useGovernanceDecentralization() {
  return useQuery({
    queryKey: ['governance-decentralization'],
    queryFn: () => fetchJson('/api/governance/decentralization'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernancePulse() {
  return useQuery({
    queryKey: ['governance-pulse'],
    queryFn: () => fetchJson('/api/governance/pulse'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceInterBody() {
  return useQuery({
    queryKey: ['governance-inter-body'],
    queryFn: () => fetchJson('/api/governance/inter-body'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceConstellation() {
  return useQuery({
    queryKey: ['governance-constellation'],
    queryFn: () => fetchJson('/api/governance/constellation'),
    staleTime: 5 * 60_000,
  });
}

export function useGovernanceProposalTrends() {
  return useQuery({
    queryKey: ['governance-proposal-trends'],
    queryFn: () => fetchJson('/api/governance/proposal-trends'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceCohorts() {
  return useQuery({
    queryKey: ['governance-cohorts'],
    queryFn: () => fetchJson('/api/governance/cohorts'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceFootprint(stakeAddress: string | null | undefined) {
  return useQuery({
    queryKey: ['governance-footprint', stakeAddress],
    queryFn: () =>
      fetchJson(`/api/governance/footprint?stakeAddress=${encodeURIComponent(stakeAddress!)}`),
    enabled: !!stakeAddress,
    staleTime: 5 * 60_000,
  });
}

export function useGovernanceForYou() {
  return useQuery({
    queryKey: ['governance-for-you'],
    queryFn: () => fetchJson('/api/governance/for-you'),
    staleTime: 5 * 60_000,
  });
}

// -- Citizen consequence story --

export interface ConsequenceProposal {
  txHash: string;
  index: number;
  title: string | null;
  proposalType: string;
  outcome: 'ratified' | 'dropped' | 'expired' | null;
  outcomeEpoch: number | null;
  withdrawalAda: number | null;
  aiSummary: string | null;
  drepVote: string | null;
  communitySignal: {
    support: number;
    oppose: number;
    unsure: number;
    total: number;
  } | null;
  userSignal: string | null;
}

export interface EpochConsequenceData {
  epoch: number;
  adaDecided: number;
  votingPowerFraction: number | null;
  votingPowerAda: number | null;
  decidedProposals: ConsequenceProposal[];
  activeProposals: ConsequenceProposal[];
}

export function useEpochConsequence(wallet: string | null | undefined) {
  return useQuery<EpochConsequenceData>({
    queryKey: ['epoch-consequence', wallet ?? 'anon'],
    queryFn: () => fetchJson('/api/citizen/epoch-consequence'),
    staleTime: 2 * 60 * 1000,
  });
}

export function useSpoVotes(txHash: string, index: number) {
  return useQuery({
    queryKey: ['spo-votes', txHash, index],
    queryFn: () =>
      fetchJson(`/api/governance/spo-votes?txHash=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
    staleTime: 5 * 60_000,
  });
}

export function useCcVotes(txHash: string, index: number) {
  return useQuery({
    queryKey: ['cc-votes', txHash, index],
    queryFn: () =>
      fetchJson(`/api/governance/cc-votes?txHash=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
    staleTime: 5 * 60_000,
  });
}

export function usePollResults(params?: string) {
  return useQuery({
    queryKey: ['poll-results', params],
    queryFn: () => fetchJson(`/api/polls/results${params ? `?${params}` : ''}`),
    enabled: params !== undefined,
    staleTime: 120_000,
  });
}

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => fetchJson('/api/user'),
    staleTime: 120_000,
  });
}

export function useAdminCheck(isAuthenticated = false) {
  return useQuery({
    queryKey: ['admin-check', isAuthenticated],
    queryFn: async () => {
      const { getStoredSession } = await import('@/lib/supabaseAuth');
      const token = getStoredSession();
      if (!token) return { isAdmin: false };
      const res = await fetch('/api/admin/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
    enabled: isAuthenticated,
  });
}

export function useProfileViews(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-views', drepId],
    queryFn: () => fetchJson(`/api/views?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 120_000,
  });
}

export function useScoreHistory(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['score-history', drepId],
    queryFn: () => fetchJson(`/api/score-history?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export function useSocialProof(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['social-proof', drepId],
    queryFn: () => fetchJson(`/api/social-proof?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export function useGovernanceEpochRecap() {
  return useQuery({
    queryKey: ['governance-epoch-recap'],
    queryFn: () => fetchJson('/api/governance/epoch-recap'),
    staleTime: 10 * 60_000,
  });
}

export function useSimilarDReps(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['similar-dreps', drepId],
    queryFn: () => fetchJson(`/api/dreps/${encodeURIComponent(drepId!)}/similar`),
    enabled: !!drepId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGovernanceDrepFeed() {
  return useQuery({
    queryKey: ['governance-drep-feed'],
    queryFn: () => fetchJson('/api/governance/drep-feed'),
    staleTime: 10 * 60_000,
  });
}

export function useGovernanceQuickMatchPool() {
  return useQuery({
    queryKey: ['governance-quick-match-pool'],
    queryFn: () => fetchJson('/api/governance/quick-match-pool'),
    staleTime: 10 * 60_000,
  });
}

export function useOnboarding(wallet: string | null | undefined) {
  return useQuery({
    queryKey: ['onboarding', wallet],
    queryFn: () => fetchJson(`/api/dashboard/onboarding?wallet=${encodeURIComponent(wallet!)}`),
    enabled: !!wallet,
    staleTime: 5 * 60_000,
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => fetchJson('/api/admin/feature-flags'),
    staleTime: 5 * 60_000,
  });
}

export function useAdminIntegrity(address: string | null | undefined) {
  return useQuery({
    queryKey: ['admin-integrity', address],
    queryFn: async () => {
      const { getStoredSession } = await import('@/lib/supabaseAuth');
      const token = getStoredSession();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/admin/integrity', { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    enabled: !!address,
  });
}

export function useDRepReportCard(drepId: string | null | undefined, wallet?: string | null) {
  return useQuery({
    queryKey: ['drep-report-card', drepId, wallet],
    queryFn: () => {
      const params = new URLSearchParams({ drepId: drepId! });
      if (wallet) params.set('wallet', wallet);
      return fetchJson(`/api/governance/report-card?${params}`);
    },
    enabled: !!drepId,
    staleTime: 60_000,
  });
}

export function useDashboardCompetitive(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-competitive', drepId],
    queryFn: () => fetchJson(`/api/dashboard/competitive?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 60_000,
  });
}

export function useGovernanceCalendar() {
  return useQuery({
    queryKey: ['governance-calendar'],
    queryFn: () => fetchJson('/api/governance/calendar'),
    staleTime: 10 * 60_000,
  });
}

export function useSPOSummary(poolId: string | null | undefined) {
  return useQuery({
    queryKey: ['spo-summary', poolId],
    queryFn: () => fetchJson(`/api/governance/pools/${encodeURIComponent(poolId!)}/summary`),
    enabled: !!poolId,
    staleTime: 60_000,
  });
}

export function useSPOVotesHistory(poolId: string | null | undefined) {
  return useQuery({
    queryKey: ['spo-votes-history', poolId],
    queryFn: () => fetchJson(`/api/governance/pools/${encodeURIComponent(poolId!)}/votes`),
    enabled: !!poolId,
    staleTime: 60_000,
  });
}

export function useSPODelegatorTrends(poolId: string | null | undefined) {
  return useQuery({
    queryKey: ['spo-delegator-trends', poolId],
    queryFn: () =>
      fetchJson(`/api/governance/pools/${encodeURIComponent(poolId!)}/delegator-trends`),
    enabled: !!poolId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useSPOPoolCompetitive(poolId: string | null | undefined) {
  return useQuery({
    queryKey: ['spo-pool-competitive', poolId],
    queryFn: () => fetchJson(`/api/governance/pools/${encodeURIComponent(poolId!)}/competitive`),
    enabled: !!poolId,
    staleTime: 60_000,
  });
}

export function useSPOUrgent(poolId: string | null | undefined) {
  return useQuery({
    queryKey: ['spo-urgent', poolId],
    queryFn: () => fetchJson(`/api/dashboard/spo-urgent?poolId=${encodeURIComponent(poolId!)}`),
    enabled: !!poolId,
    staleTime: 120_000,
  });
}

export function useProposalOutcome(txHash: string | null | undefined, index: number | undefined) {
  return useQuery({
    queryKey: ['proposal-outcome', txHash, index],
    queryFn: () =>
      fetchJson(`/api/governance/outcomes?txHash=${encodeURIComponent(txHash!)}&index=${index}`),
    enabled: !!txHash && index !== undefined,
    staleTime: 5 * 60_000,
  });
}

export function useDRepOutcomeSummary(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['drep-outcome-summary', drepId],
    queryFn: () => fetchJson(`/api/governance/outcomes?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 5 * 60_000,
  });
}

export interface AlignmentDriftData {
  hasDelegation: boolean;
  drepId?: string;
  drift: {
    score: number;
    classification: 'low' | 'moderate' | 'high';
    dimensions: Array<{
      dimension: string;
      citizenValue: number;
      drepValue: number;
      delta: number;
    }>;
    worstDimension: string | null;
  } | null;
  alternatives: Array<{
    drep_id: string;
    match_score: number;
    governance_score: number;
  }>;
  message?: string;
}

export function useAlignmentDrift(wallet: string | null | undefined) {
  return useQuery<AlignmentDriftData>({
    queryKey: ['alignment-drift', wallet],
    queryFn: () => fetchJson(`/api/governance/drift?wallet=${encodeURIComponent(wallet!)}`),
    enabled: !!wallet,
    staleTime: 5 * 60_000,
  });
}

export function useAccountInfo(stakeAddress: string | null | undefined) {
  return useQuery({
    queryKey: ['account-info', stakeAddress],
    queryFn: () =>
      fetchJson<{
        stakeAddress: string;
        totalBalanceAda: number;
        rewardsAda: number;
        delegatedDrep: string | null;
        delegatedPool: string | null;
      }>(`/api/user/account-info?stakeAddress=${encodeURIComponent(stakeAddress!)}`),
    enabled: !!stakeAddress,
    staleTime: 120_000,
  });
}

// ── Workspace Cockpit (aggregate) ────────────────────────────────────

export interface CockpitProposal {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  epochsRemaining: number | null;
  isUrgent: boolean;
  aiSummary: string | null;
  abstract: string | null;
  drepVoteTally: { yes: number; no: number; abstain: number };
  citizenSentiment: {
    support: number;
    oppose: number;
    abstain: number;
    total: number;
  } | null;
}

export interface ScoreStoryPillar {
  key: string;
  label: string;
  value: number;
  weight: number;
  scoreImpact: number;
  action: string;
}

export interface CockpitData {
  score: {
    current: number;
    trend: number;
    trendSince: string | null;
    tier: string;
    tierProgress: {
      currentTier: string;
      score: number;
      pointsToNext: number | null;
      percentWithinTier: number;
      nextTier: string | null;
      recommendedAction: string | null;
    };
    narrative: string;
    percentile: number;
    rank: number | null;
    totalDReps: number;
    pillars: {
      engagementQuality: number;
      effectiveParticipation: number;
      reliability: number;
      governanceIdentity: number;
    };
  };
  actionFeed: {
    pendingProposals: CockpitProposal[];
    pendingCount: number;
    unexplainedVotes: { txHash: string; index: number; title: string }[];
    unansweredQuestions: number;
    delegatorAlerts: { change: number; currentCount: number | null };
    scoreAlerts: { delta: number; recommendation: string | null };
  };
  delegation: {
    currentDelegators: number | null;
    delegatorDelta: number;
    snapshots: { epoch: number; votingPowerAda: number; delegatorCount: number }[];
  };
  activityHeatmap: {
    epochs: { epoch: number; votes: number }[];
    streak: number;
  };
  scoreStory: {
    pillars: ScoreStoryPillar[];
    biggestWin: string;
  };
}

export function useWorkspaceCockpit(drepId: string | null | undefined) {
  return useQuery<CockpitData>({
    queryKey: ['workspace-cockpit', drepId],
    queryFn: () =>
      fetchJson<CockpitData>(`/api/workspace/cockpit?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
    staleTime: 30_000,
  });
}

// ── Citizen Impact Score ─────────────────────────────────────────────────────

export interface ImpactScoreResponse {
  score: number;
  delegationTenureScore: number;
  repActivityScore: number;
  engagementDepthScore: number;
  coverageScore: number;
  computed: boolean;
}

export function useCitizenImpactScore(enabled: boolean) {
  return useQuery<ImpactScoreResponse>({
    queryKey: ['citizen-impact-score'],
    queryFn: () => fetchJson<ImpactScoreResponse>('/api/you/impact-score'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ── Delegator Intelligence ────────────────────────────────────────────

export interface DelegatorIntelligenceData {
  topPriorities: { priority: string; count: number }[];
  sentimentByProposal: {
    proposalTxHash: string;
    proposalIndex: number;
    title: string | null;
    support: number;
    oppose: number;
    abstain: number;
    total: number;
  }[];
  avgEngagement: number;
  engagedDelegators: number;
  totalDelegators: number;
}

export function useDelegatorIntelligence(drepId: string | null | undefined) {
  return useQuery<DelegatorIntelligenceData>({
    queryKey: ['delegator-intelligence', drepId],
    queryFn: () =>
      fetchJson<DelegatorIntelligenceData>(
        `/api/workspace/delegator-intelligence?drepId=${encodeURIComponent(drepId!)}`,
      ),
    enabled: !!drepId,
    staleTime: 120_000,
  });
}

// ── Constitutional Intelligence ──────────────────────────────────────────────

export interface CCMemberIntelligence {
  chamberPosition: {
    archetypeLabel: string;
    archetypeDescription: string | null;
    mostAligned: { memberId: string; pct: number } | null;
    mostDivergent: { memberId: string; pct: number } | null;
    blocLabel: string;
    soleDissenterCount: number;
    soleDissenterProposals: string[];
    strictnessScore: number;
    independenceProfile: string;
  } | null;
  dossier: {
    executiveSummary: string;
    behavioralPatterns: string | null;
    constitutionalProfile: string | null;
  } | null;
  keyFinding: { finding: string; severity: string } | null;
  pairwiseAlignment: {
    memberId: string;
    voteAgreementPct: number;
    reasoningSimilarityPct: number;
    sharedProposals: number;
  }[];
  interpretationHistory: {
    article: string;
    entries: {
      proposalTxHash: string;
      proposalIndex: number;
      epoch: number;
      stance: string;
      summary: string;
      consistentWithPrior: boolean;
      driftNote: string | null;
    }[];
  }[];
  rationaleAnalyses: {
    proposalTxHash: string;
    proposalIndex: number;
    deliberationQuality: number;
    rationalityScore: number;
    reciprocityScore: number;
    clarityScore: number;
    notableFinding: string | null;
    findingSeverity: string | null;
    novelInterpretation: boolean;
    contradictsOwnPrecedent: boolean;
  }[];
}

export function useCCMemberIntelligence(ccHotId: string) {
  return useQuery<CCMemberIntelligence>({
    queryKey: ['cc-member-intelligence', ccHotId],
    queryFn: () =>
      fetchJson<CCMemberIntelligence>(`/api/governance/committee/${encodeURIComponent(ccHotId)}`),
    staleTime: 2 * 60 * 1000,
    enabled: !!ccHotId,
  });
}

export interface CCBriefingFull {
  headline: string;
  executiveSummary: string;
  keyFindings: { finding: string; severity: string }[];
  whatChanged: string | null;
  fullNarrative: string | null;
  generatedAt: string;
}

export function useCCBriefing(persona?: string) {
  return useQuery<{ briefing: CCBriefingFull | null }>({
    queryKey: ['cc-briefing', persona ?? 'default'],
    queryFn: () =>
      fetchJson<{ briefing: CCBriefingFull | null }>(
        `/api/governance/committee/briefing${persona ? `?persona=${encodeURIComponent(persona)}` : ''}`,
      ),
    staleTime: 2 * 60 * 1000,
  });
}

export interface CCPrediction {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  proposalType: string | null;
  predictedOutcome: string;
  predictedSplit: Record<string, string[]> | null;
  confidence: number;
  reasoning: string | null;
  keyArticle: string | null;
  tensionFlag: boolean;
  predictedAt: string;
}

export interface CCPredictionsResponse {
  predictions: CCPrediction[];
  accuracy: {
    totalPredictions: number;
    correct: number;
    accuracyPct: number | null;
  };
}

export function useCCPredictions() {
  return useQuery<CCPredictionsResponse>({
    queryKey: ['cc-predictions'],
    queryFn: () => fetchJson<CCPredictionsResponse>('/api/governance/committee/predict'),
    staleTime: 2 * 60 * 1000,
  });
}

// ── AI Character Profiles ─────────────────────────────────────────────────────

export interface CharacterOutput {
  title: string;
  summary: string;
  pills: Array<{ label: string; reason: string }>;
}

export function useDRepCharacter(drepId: string) {
  return useQuery<CharacterOutput | null>({
    queryKey: ['drep-character', drepId],
    queryFn: () => fetchJson<CharacterOutput | null>(`/api/drep/${drepId}/basic?character=1`),
    staleTime: 5 * 60 * 1000,
    enabled: !!drepId,
  });
}

export function useSPOCharacter(poolId: string) {
  return useQuery<CharacterOutput | null>({
    queryKey: ['spo-character', poolId],
    queryFn: () =>
      fetchJson<CharacterOutput | null>(`/api/governance/pools/${poolId}/summary?character=1`),
    staleTime: 5 * 60 * 1000,
    enabled: !!poolId,
  });
}

// ── Treasury Spending Categories ──────────────────────────────────────────────

export interface TreasuryCategoriesResponse {
  categories: {
    category: string;
    totalAda: number;
    proposalCount: number;
    pctOfTotal: number;
    proposals: {
      title: string;
      amountAda: number;
      epoch: number;
      txHash: string;
      index: number;
    }[];
  }[];
  trend: {
    epoch: number;
    categories: Record<string, number>;
  }[];
}

export function useTreasuryCategories() {
  return useQuery<TreasuryCategoriesResponse>({
    queryKey: ['treasury-categories'],
    queryFn: () => fetchJson<TreasuryCategoriesResponse>('/api/treasury/categories'),
    staleTime: 60 * 60 * 1000,
  });
}

// ── Observatory Narratives ────────────────────────────────────────────────────

export interface ObservatoryNarrativesResponse {
  unified: string | null;
  treasury: string | null;
  committee: string | null;
  health: string | null;
  generatedAt: string;
}

export function useObservatoryNarratives(epoch: number) {
  return useQuery<ObservatoryNarrativesResponse>({
    queryKey: ['observatory-narratives', epoch],
    queryFn: () =>
      fetchJson<ObservatoryNarrativesResponse>(`/api/observatory/narrative?epoch=${epoch}`),
    staleTime: 5 * 60_000,
    enabled: epoch > 0,
  });
}
