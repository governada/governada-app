'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SectionSentiment } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Fetch helpers (same pattern as hooks/useDrafts.ts)
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
// Queries
// ---------------------------------------------------------------------------

/** Fetch aggregated section sentiment for an amendment draft. */
export function useAmendmentSentiment(draftId: string | null) {
  return useQuery<{ sections: Record<string, SectionSentiment> }>({
    queryKey: ['amendment-sentiment', draftId],
    queryFn: () =>
      fetchJson(`/api/workspace/amendment-sentiment?draftId=${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Submit or update the current user's sentiment on a section. */
export function useSubmitSentiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      draftId: string;
      sectionId: string;
      sentiment: 'support' | 'oppose' | 'neutral';
      comment?: string;
    }) =>
      postJson<{
        sentiment: {
          id: string;
          draftId: string;
          sectionId: string;
          userId: string;
          sentiment: string;
          comment: string | null;
          createdAt: string;
          updatedAt: string;
        };
      }>('/api/workspace/amendment-sentiment', body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['amendment-sentiment', variables.draftId] });
    },
  });
}
