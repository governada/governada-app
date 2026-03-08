'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
  });
}

export function useGovernanceHealthIndex(epochs = 20) {
  return useQuery({
    queryKey: ['ghi-history', epochs],
    queryFn: () => fetchJson(`/api/governance/health-index/history?epochs=${epochs}`),
  });
}

export function useGovernanceTimeline() {
  return useQuery({
    queryKey: ['governance-timeline'],
    queryFn: () => fetchJson('/api/governance/timeline'),
  });
}

export function useGovernanceBenchmarks() {
  return useQuery({
    queryKey: ['governance-benchmarks'],
    queryFn: () => fetchJson('/api/governance/benchmarks'),
  });
}

export function useGovernanceSparklines() {
  return useQuery({
    queryKey: ['governance-sparklines'],
    queryFn: () => fetchJson('/api/governance/sparklines'),
  });
}

export function useGovernanceInsights() {
  return useQuery({
    queryKey: ['governance-insights'],
    queryFn: () => fetchJson('/api/governance/insights'),
  });
}

export function useGovernanceActivity(limit = 20) {
  return useQuery({
    queryKey: ['governance-activity', limit],
    queryFn: () => fetchJson(`/api/governance/activity?limit=${limit}`),
  });
}

export function useGovernanceLeaderboard(tier?: string) {
  return useQuery({
    queryKey: ['governance-leaderboard', tier],
    queryFn: () =>
      fetchJson(tier ? `/api/governance/leaderboard?tier=${tier}` : '/api/governance/leaderboard'),
  });
}

export function useDRepVotes(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['drep-votes', drepId],
    queryFn: () => fetchJson(`/api/drep/${drepId}/votes`),
    enabled: !!drepId,
  });
}

export function useDRepTrajectory(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['drep-trajectory', drepId],
    queryFn: () => fetchJson(`/api/drep/${drepId}/trajectory`),
    enabled: !!drepId,
  });
}

export function useDReps(limit?: number) {
  return useQuery({
    queryKey: ['dreps', limit],
    queryFn: () => fetchJson(limit ? `/api/dreps?limit=${limit}` : '/api/dreps'),
  });
}

export function useProposals(limit?: number) {
  return useQuery({
    queryKey: ['proposals', limit],
    queryFn: () => fetchJson(limit ? `/api/proposals?limit=${limit}` : '/api/proposals'),
  });
}

export function useSimilarProposals(txHash: string, index: number) {
  return useQuery({
    queryKey: ['similar-proposals', txHash, index],
    queryFn: () =>
      fetchJson(`/api/proposals/similar?tx=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
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
  });
}

export function useTreasuryCurrent() {
  return useQuery({
    queryKey: ['treasury-current'],
    queryFn: () => fetchJson('/api/treasury/current'),
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
  });
}

export function useTreasuryPending() {
  return useQuery({
    queryKey: ['treasury-pending'],
    queryFn: () => fetchJson('/api/treasury/pending'),
  });
}

export function useTreasuryHistory(epochs = 30) {
  return useQuery({
    queryKey: ['treasury-history', epochs],
    queryFn: () => fetchJson(`/api/treasury/history?epochs=${epochs}`),
  });
}

export function useTreasurySimulate(burnAdjust: number) {
  return useQuery({
    queryKey: ['treasury-simulate', burnAdjust],
    queryFn: () => fetchJson(`/api/treasury/simulate?burnAdjust=${burnAdjust}`),
  });
}

export function useTreasurySimilar(txHash: string, index: number) {
  return useQuery({
    queryKey: ['treasury-similar', txHash, index],
    queryFn: () =>
      fetchJson(`/api/treasury/similar?txHash=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
  });
}

export function useDashboardUrgent(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-urgent', drepId],
    queryFn: () => fetchJson(`/api/dashboard/urgent?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
  });
}

export function useDashboardRepresentation(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-representation', drepId],
    queryFn: () => fetchJson(`/api/dashboard/representation?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
  });
}

export function useDashboardScoreChange(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-score-change', drepId],
    queryFn: () => fetchJson(`/api/dashboard/score-change?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
  });
}

export function useDashboardDelegatorTrends(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-delegator-trends', drepId],
    queryFn: () =>
      fetchJson(`/api/dashboard/delegator-trends?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
  });
}

export function useDashboardInbox(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-inbox', drepId],
    queryFn: () => fetchJson(`/api/dashboard/inbox?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
  });
}

export function useGovernanceDecentralization() {
  return useQuery({
    queryKey: ['governance-decentralization'],
    queryFn: () => fetchJson('/api/governance/decentralization'),
  });
}

export function useGovernancePulse() {
  return useQuery({
    queryKey: ['governance-pulse'],
    queryFn: () => fetchJson('/api/governance/pulse'),
  });
}

export function useGovernanceInterBody() {
  return useQuery({
    queryKey: ['governance-inter-body'],
    queryFn: () => fetchJson('/api/governance/inter-body'),
  });
}

export function useGovernanceConstellation() {
  return useQuery({
    queryKey: ['governance-constellation'],
    queryFn: () => fetchJson('/api/governance/constellation'),
  });
}

export function useGovernanceProposalTrends() {
  return useQuery({
    queryKey: ['governance-proposal-trends'],
    queryFn: () => fetchJson('/api/governance/proposal-trends'),
  });
}

export function useGovernanceCohorts() {
  return useQuery({
    queryKey: ['governance-cohorts'],
    queryFn: () => fetchJson('/api/governance/cohorts'),
  });
}

export function useGovernanceFootprint(stakeAddress: string | null | undefined) {
  return useQuery({
    queryKey: ['governance-footprint', stakeAddress],
    queryFn: () =>
      fetchJson(`/api/governance/footprint?stakeAddress=${encodeURIComponent(stakeAddress!)}`),
    enabled: !!stakeAddress,
  });
}

export function useGovernanceForYou() {
  return useQuery({
    queryKey: ['governance-for-you'],
    queryFn: () => fetchJson('/api/governance/for-you'),
  });
}

export function useSpoVotes(txHash: string, index: number) {
  return useQuery({
    queryKey: ['spo-votes', txHash, index],
    queryFn: () =>
      fetchJson(`/api/governance/spo-votes?txHash=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
  });
}

export function useCcVotes(txHash: string, index: number) {
  return useQuery({
    queryKey: ['cc-votes', txHash, index],
    queryFn: () =>
      fetchJson(`/api/governance/cc-votes?txHash=${encodeURIComponent(txHash)}&index=${index}`),
    enabled: !!txHash,
  });
}

export function usePollResults(params?: string) {
  return useQuery({
    queryKey: ['poll-results', params],
    queryFn: () => fetchJson(`/api/polls/results${params ? `?${params}` : ''}`),
    enabled: params !== undefined,
  });
}

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => fetchJson('/api/user'),
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
  });
}

export function useScoreHistory(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['score-history', drepId],
    queryFn: () => fetchJson(`/api/score-history?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
  });
}

export function useSocialProof(drepId: string | null | undefined) {
  return useQuery({
    queryKey: ['social-proof', drepId],
    queryFn: () => fetchJson(`/api/social-proof?drepId=${encodeURIComponent(drepId!)}`),
    enabled: !!drepId,
  });
}

export function useGovernanceEpochRecap() {
  return useQuery({
    queryKey: ['governance-epoch-recap'],
    queryFn: () => fetchJson('/api/governance/epoch-recap'),
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
  });
}

export function useGovernanceQuickMatchPool() {
  return useQuery({
    queryKey: ['governance-quick-match-pool'],
    queryFn: () => fetchJson('/api/governance/quick-match-pool'),
  });
}

export function useOnboarding(wallet: string | null | undefined) {
  return useQuery({
    queryKey: ['onboarding', wallet],
    queryFn: () => fetchJson(`/api/dashboard/onboarding?wallet=${encodeURIComponent(wallet!)}`),
    enabled: !!wallet,
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => fetchJson('/api/admin/feature-flags'),
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
