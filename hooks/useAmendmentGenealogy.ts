'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GenealogyEntry } from '@/lib/constitution/types';

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

/** Fetch the genealogy timeline for an amendment draft. */
export function useAmendmentGenealogy(draftId: string | null) {
  return useQuery<{ entries: GenealogyEntry[] }>({
    queryKey: ['amendment-genealogy', draftId],
    queryFn: () =>
      fetchJson(`/api/workspace/amendment-genealogy?draftId=${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Record a new genealogy event for an amendment change. */
export function useRecordGenealogy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      draftId: string;
      changeId: string;
      action: 'created' | 'accepted' | 'rejected' | 'modified' | 'merged';
      actionReason?: string;
      sourceType?: 'author' | 'reviewer' | 'ai';
    }) => postJson<{ entry: GenealogyEntry }>('/api/workspace/amendment-genealogy', body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['amendment-genealogy', variables.draftId] });
    },
  });
}
