'use client';

import { useQuery } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';

const STALE_30S = 30_000;
const STALE_60S = 60_000;

async function fetchJsonWithAuth<T>(url: string): Promise<T> {
  const headers: HeadersInit = {};
  const token = getStoredSession();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// -- Sentiment --

export interface SentimentResults {
  community: { support: number; oppose: number; unsure: number; total: number };
  delegators?: { support: number; oppose: number; unsure: number; total: number };
  stakeWeighted?: { support: number; oppose: number; unsure: number; total: number };
  userSentiment: 'support' | 'oppose' | 'unsure' | null;
  hasVoted: boolean;
}

export function useSentimentResults(txHash: string, proposalIndex: number, drepId?: string | null) {
  const params = new URLSearchParams({
    proposalTxHash: txHash,
    proposalIndex: String(proposalIndex),
  });
  if (drepId) params.set('drepId', drepId);

  return useQuery<SentimentResults>({
    queryKey: ['citizen-sentiment', txHash, proposalIndex, drepId ?? null],
    queryFn: () => fetchJsonWithAuth(`/api/engagement/sentiment/results?${params}`),
    staleTime: STALE_30S,
  });
}

// -- Concern Flags --

export interface ConcernFlagResults {
  flags: Record<string, number>;
  total: number;
  userFlags: string[];
}

export function useConcernFlags(txHash: string, proposalIndex: number) {
  return useQuery<ConcernFlagResults>({
    queryKey: ['concern-flags', txHash, proposalIndex],
    queryFn: () =>
      fetchJsonWithAuth(
        `/api/engagement/concerns/results?proposalTxHash=${txHash}&proposalIndex=${proposalIndex}`,
      ),
    staleTime: STALE_30S,
  });
}

// -- Impact Tags --

export interface ImpactTagResults {
  awareness: Record<string, number>;
  ratings: Record<string, number>;
  total: number;
  userTag: { awareness: string; rating: string } | null;
}

export function useImpactTags(txHash: string, proposalIndex: number) {
  return useQuery<ImpactTagResults>({
    queryKey: ['impact-tags', txHash, proposalIndex],
    queryFn: () =>
      fetchJsonWithAuth(
        `/api/engagement/impact/results?proposalTxHash=${txHash}&proposalIndex=${proposalIndex}`,
      ),
    staleTime: STALE_30S,
  });
}

// -- Priority Signals --

export interface PriorityRankings {
  rankings: { priority: string; score: number; rank: number; firstChoiceCount: number }[];
  totalVoters: number;
  epoch: number;
}

export function usePriorityRankings(epoch?: number) {
  const params = epoch ? `?epoch=${epoch}` : '';
  return useQuery<PriorityRankings>({
    queryKey: ['priority-rankings', epoch ?? 'current'],
    queryFn: () => fetchJsonWithAuth(`/api/engagement/priorities/results${params}`),
    staleTime: STALE_60S,
  });
}

export interface UserPrioritySignal {
  rankedPriorities: string[];
  epoch: number;
}

export function useUserPrioritySignal(epoch?: number) {
  const params = epoch ? `?epoch=${epoch}` : '';
  return useQuery<UserPrioritySignal | null>({
    queryKey: ['user-priority-signal', epoch ?? 'current'],
    queryFn: () => fetchJsonWithAuth(`/api/engagement/priorities/user${params}`),
    staleTime: STALE_60S,
  });
}

// -- Assemblies --

export interface Assembly {
  id: string;
  title: string;
  description: string | null;
  question: string;
  options: { key: string; label: string; description?: string }[];
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  epoch: number;
  opensAt: string;
  closesAt: string;
  results: { key: string; label: string; count: number; percentage: number }[] | null;
  totalVotes: number;
}

export interface AssemblyWithUserVote extends Assembly {
  userVote: string | null;
}

export function useActiveAssembly() {
  return useQuery<AssemblyWithUserVote | null>({
    queryKey: ['active-assembly'],
    queryFn: () => fetchJsonWithAuth('/api/engagement/assembly/active'),
    staleTime: STALE_60S,
  });
}

export function useAssemblyHistory() {
  return useQuery<Assembly[]>({
    queryKey: ['assembly-history'],
    queryFn: () => fetchJsonWithAuth('/api/engagement/assembly/history'),
    staleTime: STALE_60S,
  });
}
