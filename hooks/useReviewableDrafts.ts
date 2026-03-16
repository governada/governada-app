'use client';

/**
 * useReviewableDrafts — fetches pre-submission drafts open for community review.
 *
 * Queries /api/workspace/drafts with a status filter for `community_review`
 * or `final_comment`. Returns ProposalDraft[] items in a format compatible
 * with the review queue display.
 */

import { useQuery } from '@tanstack/react-query';
import type { ProposalDraft } from '@/lib/workspace/types';

interface ReviewableDraftsResponse {
  drafts: ProposalDraft[];
}

async function fetchReviewableDrafts(): Promise<ReviewableDraftsResponse> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }

  const res = await fetch('/api/workspace/drafts?status=community_review,final_comment', {
    headers,
  });
  if (!res.ok) {
    // Return empty if no reviewable drafts or API not updated yet
    return { drafts: [] };
  }
  return res.json();
}

export function useReviewableDrafts() {
  return useQuery<ReviewableDraftsResponse>({
    queryKey: ['reviewable-drafts'],
    queryFn: fetchReviewableDrafts,
    staleTime: 60_000,
  });
}
