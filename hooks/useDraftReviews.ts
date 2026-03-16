'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DraftReview, DraftReviewResponse } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewsResponse {
  reviews: DraftReview[];
  aggregateScores: {
    impact: number | null;
    feasibility: number | null;
    constitutional: number | null;
    value: number | null;
  };
  responsesByReview: Record<
    string,
    Array<{
      id: string;
      responseType: string;
      responseText: string;
      createdAt: string;
    }>
  >;
  total: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all reviews for a draft with aggregate scores */
export function useDraftReviews(draftId: string | null) {
  return useQuery<ReviewsResponse>({
    queryKey: ['draft-reviews', draftId],
    queryFn: () => fetchJson(`/api/workspace/drafts/${encodeURIComponent(draftId!)}/reviews`),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Submit a structured review for a draft */
export function useSubmitReview(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      reviewerStakeAddress: string;
      impactScore?: number;
      feasibilityScore?: number;
      constitutionalScore?: number;
      valueScore?: number;
      feedbackText: string;
      feedbackThemes?: string[];
    }) =>
      postJson<{ review: DraftReview }>(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}/reviews`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-reviews', draftId] });
    },
  });
}

/** Author responds to a specific review */
export function useRespondToReview(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      responseType,
      responseText,
    }: {
      reviewId: string;
      responseType: 'accept' | 'decline' | 'modify';
      responseText: string;
    }) =>
      postJson<{ response: DraftReviewResponse }>(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}/reviews/${encodeURIComponent(reviewId)}/respond`,
        { responseType, responseText },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-reviews', draftId] });
    },
  });
}
