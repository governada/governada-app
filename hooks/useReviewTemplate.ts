'use client';

/**
 * useReviewTemplate — fetches the default review framework template
 * for a given proposal type.
 *
 * Returns a ReviewFrameworkTemplate with checklist items that help
 * DReps/SPOs evaluate proposals systematically.
 */

import { useQuery } from '@tanstack/react-query';
import type { ReviewFrameworkTemplate } from '@/lib/workspace/types';

async function fetchReviewTemplate(proposalType: string): Promise<ReviewFrameworkTemplate | null> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }

  const res = await fetch(
    `/api/workspace/review-templates?proposalType=${encodeURIComponent(proposalType)}`,
    { headers },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.template ?? null;
}

export function useReviewTemplate(proposalType: string | null | undefined) {
  return useQuery<ReviewFrameworkTemplate | null>({
    queryKey: ['review-template', proposalType],
    queryFn: () => fetchReviewTemplate(proposalType!),
    enabled: !!proposalType,
    staleTime: 5 * 60_000, // Templates change rarely — cache 5 min
  });
}
