'use client';

/**
 * Hook to fetch pre-computed intelligence sections for a proposal.
 *
 * Returns cached constitutional check, key questions, and passage prediction
 * from the background pre-computation pipeline. Falls back to null per section
 * if not yet cached — components then fire on-demand AI calls.
 */

import { useQuery } from '@tanstack/react-query';

interface CachedConstitutional {
  flags: Array<{
    article: string;
    section?: string;
    concern: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  score: 'pass' | 'warning' | 'fail';
  summary: string;
  cachedAt: string;
}

interface CachedKeyQuestions {
  questionsToConsider: string[];
  precedentSummary: string;
  cachedAt: string;
}

interface CachedPassagePrediction {
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  factors: Array<{
    name: string;
    weight: number;
    value: number;
    direction: 'positive' | 'negative' | 'neutral';
  }>;
  computedAt: string;
  cachedAt: string;
}

export interface IntelligenceCacheResult {
  constitutional: CachedConstitutional | null;
  key_questions: CachedKeyQuestions | null;
  passage_prediction: CachedPassagePrediction | null;
}

async function fetchIntelligenceCache(
  txHash: string,
  index: number,
): Promise<IntelligenceCacheResult> {
  const res = await fetch(
    `/api/workspace/intelligence-cache?txHash=${encodeURIComponent(txHash)}&index=${index}`,
  );
  if (!res.ok) throw new Error('Failed to fetch intelligence cache');
  return res.json();
}

export function useIntelligenceCache(txHash: string | undefined, index: number | undefined) {
  return useQuery({
    queryKey: ['intelligence-cache', txHash, index],
    queryFn: () => fetchIntelligenceCache(txHash!, index!),
    enabled: !!txHash && index != null,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
