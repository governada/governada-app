'use client';

import { useQuery } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';

interface EpochHeadlineResponse {
  headline: string | null;
  epoch: number | null;
}

async function fetchEpochHeadline(): Promise<EpochHeadlineResponse> {
  const token = getStoredSession();
  if (!token) return { headline: null, epoch: null };

  const res = await fetch('/api/you/epoch-headline', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { headline: null, epoch: null };
  return res.json();
}

export function useEpochHeadline(enabled: boolean) {
  const { data } = useQuery<EpochHeadlineResponse>({
    queryKey: ['epoch-headline'],
    queryFn: fetchEpochHeadline,
    enabled,
    staleTime: 5 * 60_000, // 5 min — headlines change per epoch, not per minute
  });

  return {
    aiHeadline: data?.headline ?? null,
    headlineEpoch: data?.epoch ?? null,
  };
}
