'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamApproval {
  memberId: string;
  stakeAddress: string;
  role: string;
  approvedAt: string | null;
}

export interface ApprovalsResponse {
  approvals: TeamApproval[];
  allApproved: boolean;
  pendingCount: number;
}

// ---------------------------------------------------------------------------
// Fetch helpers (same pattern as useTeam.ts)
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

/** Fetch team approval status for a draft */
export function useTeamApprovals(draftId: string | null) {
  return useQuery<ApprovalsResponse>({
    queryKey: ['team-approvals', draftId],
    queryFn: () => fetchJson(`/api/workspace/drafts/${encodeURIComponent(draftId!)}/approvals`),
    enabled: !!draftId,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Record approval for the current user */
export function useApproveSubmission(draftId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; approvedAt: string }, Error, { stakeAddress: string }>({
    mutationFn: ({ stakeAddress }) =>
      postJson(`/api/workspace/drafts/${encodeURIComponent(draftId)}/approvals`, {
        stakeAddress,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-approvals', draftId] });
    },
  });
}
