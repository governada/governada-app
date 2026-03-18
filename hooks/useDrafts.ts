'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/lib/workspace/mutations';
import { toastSuccess, toastError } from '@/lib/workspace/toast';
import { useSaveStatus } from '@/lib/workspace/save-status';
import type { ProposalDraft, DraftVersion, ConstitutionalCheckResult } from '@/lib/workspace/types';
import type { Cip108Document } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Fetch helpers (same pattern as hooks/queries.ts)
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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all drafts for a user */
export function useDrafts(stakeAddress: string | null) {
  return useQuery<{ drafts: ProposalDraft[] }>({
    queryKey: ['author-drafts', stakeAddress],
    queryFn: () =>
      fetchJson(`/api/workspace/drafts?stakeAddress=${encodeURIComponent(stakeAddress!)}`),
    enabled: !!stakeAddress,
    staleTime: 30_000,
  });
}

/** Fetch a single draft with its versions */
export function useDraft(draftId: string | null) {
  return useQuery<{ draft: ProposalDraft; versions: DraftVersion[] }>({
    queryKey: ['author-draft', draftId],
    queryFn: () => fetchJson(`/api/workspace/drafts/${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

interface CreateDraftVars {
  stakeAddress: string;
  proposalType: string;
  title?: string;
  abstract?: string;
  motivation?: string;
  rationale?: string;
}

/**
 * Create a new draft — optimistically inserts a placeholder into the drafts list
 * so the new card appears instantly before the server round-trip completes.
 */
export function useCreateDraft() {
  const queryClient = useQueryClient();

  return useMutation<{ draft: ProposalDraft }, Error, CreateDraftVars, { previous: unknown }>({
    mutationFn: (body) => postJson<{ draft: ProposalDraft }>('/api/workspace/drafts', body),

    onMutate: async (vars) => {
      const queryKey = ['author-drafts', vars.stakeAddress];

      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      const now = new Date().toISOString();
      const tempDraft: ProposalDraft = {
        id: `temp-${Date.now()}`,
        ownerStakeAddress: vars.stakeAddress,
        proposalType: vars.proposalType as ProposalDraft['proposalType'],
        title: vars.title ?? 'Untitled Draft',
        abstract: vars.abstract ?? '',
        motivation: vars.motivation ?? '',
        rationale: vars.rationale ?? '',
        typeSpecific: null,
        status: 'draft',
        currentVersion: 1,
        supersedesId: null,
        stageEnteredAt: null,
        communityReviewStartedAt: null,
        fcpStartedAt: null,
        submittedTxHash: null,
        submittedAnchorUrl: null,
        submittedAnchorHash: null,
        submittedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData(queryKey, (old: { drafts: ProposalDraft[] } | undefined) => ({
        drafts: [tempDraft, ...(old?.drafts ?? [])],
      }));

      return { previous };
    },

    onError: (_err, vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['author-drafts', vars.stakeAddress], context.previous);
      }
      toastError('Failed to create draft');
    },

    onSuccess: () => {
      toastSuccess('Draft created');
    },

    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['author-drafts', vars.stakeAddress] });
    },
  });
}

/**
 * Update draft fields (auto-save) — optimistically patches the cached draft
 * so the editor never flickers. Uses the SaveStatus store instead of toasts
 * to avoid spamming on every keystroke.
 */
export function useUpdateDraft(draftId: string) {
  const queryClient = useQueryClient();
  const { setSaving, setSaved, setError } = useSaveStatus();

  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      patchJson<{ draft: ProposalDraft }>(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}`,
        body,
      ),

    onMutate: async (vars) => {
      setSaving();

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['author-draft', draftId] });

      // Snapshot for rollback
      const previous = queryClient.getQueryData(['author-draft', draftId]);

      // Optimistically patch the single-draft cache
      queryClient.setQueryData(
        ['author-draft', draftId],
        (old: { draft: ProposalDraft; versions: DraftVersion[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            draft: {
              ...old.draft,
              ...vars,
              updatedAt: new Date().toISOString(),
            },
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      setError();
      // Rollback
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['author-draft', draftId], context.previous);
      }
      toastError('Auto-save failed');
    },

    onSuccess: () => {
      setSaved();
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['author-draft', draftId] });
      queryClient.invalidateQueries({ queryKey: ['author-drafts'] });
    },
  });
}

/**
 * Save a named version — toast feedback on success/error.
 */
export function useSaveVersion(draftId: string) {
  return useOptimisticMutation<
    { version: DraftVersion },
    { versionName: string; editSummary?: string }
  >({
    mutationFn: (body) =>
      postJson<{ version: DraftVersion }>(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}/version`,
        body,
      ),
    queryKey: ['author-draft', draftId],
    successMessage: 'Version saved',
    errorMessage: 'Failed to save version',
  });
}

/** Run constitutional check */
export function useConstitutionalCheck() {
  return useMutation({
    mutationFn: (body: {
      title: string;
      abstract?: string;
      motivation?: string;
      rationale?: string;
      proposalType: string;
      typeSpecific?: Record<string, unknown>;
    }) => postJson<ConstitutionalCheckResult>('/api/workspace/constitutional-check', body),
  });
}

/** Generate CIP-108 preview */
export function useCip108Preview() {
  return useMutation({
    mutationFn: (body: {
      title: string;
      abstract?: string;
      motivation?: string;
      rationale?: string;
      authorName?: string;
    }) =>
      postJson<{ document: Cip108Document; contentHash: string }>(
        '/api/workspace/cip108-preview',
        body,
      ),
  });
}
