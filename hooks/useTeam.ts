'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProposalTeam, TeamMember, TeamInvite } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Fetch helpers (same pattern as useDrafts.ts)
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

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function deleteJson<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'DELETE', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch team + members for a draft */
export function useTeam(draftId: string | null) {
  return useQuery<{ team: ProposalTeam | null; members: TeamMember[] }>({
    queryKey: ['proposal-team', draftId],
    queryFn: () => fetchJson(`/api/workspace/teams?draftId=${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a team for a draft */
export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { draftId: string; name?: string }) =>
      postJson<{ team: ProposalTeam; members: TeamMember[] }>('/api/workspace/teams', body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team', variables.draftId] });
    },
  });
}

/** Generate an invite code for a team */
export function useCreateInvite() {
  return useMutation({
    mutationFn: (body: {
      teamId: string;
      role: 'editor' | 'viewer';
      expiresInHours?: number;
      maxUses?: number;
    }) => postJson<{ invite: TeamInvite }>('/api/workspace/teams/invite', body),
  });
}

/** Join a team using an invite code */
export function useJoinTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { inviteCode: string }) =>
      postJson<{ success: boolean; teamId: string }>('/api/workspace/teams/join', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team'] });
    },
  });
}

/** Update a member's role */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { memberId: string; role: 'editor' | 'viewer' }) =>
      patchJson<{ success: boolean }>('/api/workspace/teams/members', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team'] });
    },
  });
}

/** Remove a member from the team */
export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { memberId: string }) =>
      deleteJson<{ success: boolean }>('/api/workspace/teams/members', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team'] });
    },
  });
}
