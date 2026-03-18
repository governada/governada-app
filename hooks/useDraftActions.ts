'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toastSuccess, toastError } from '@/lib/workspace/toast';
import type { ProposalDraft } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Fetch helpers (match useDrafts.ts pattern)
// ---------------------------------------------------------------------------

async function patchJsonWithAuth<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function postJsonWithAuth<T>(url: string, body: unknown): Promise<T> {
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

async function deleteJsonWithAuth<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function fetchBlobWithAuth(url: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.blob();
}

// ---------------------------------------------------------------------------
// Archive (via stage endpoint)
// ---------------------------------------------------------------------------

export function useArchiveDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ draft: ProposalDraft }, Error, { draftId: string }, { previous: unknown }>({
    mutationFn: ({ draftId }) =>
      patchJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}/stage`, {
        targetStatus: 'archived',
      }),

    onMutate: async ({ draftId }) => {
      const queryKey = ['author-drafts', stakeAddress];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      // Optimistically remove from the list (archived items are excluded by default)
      queryClient.setQueryData(queryKey, (old: { drafts: ProposalDraft[] } | undefined) => {
        if (!old) return old;
        return {
          drafts: old.drafts.filter((d) => d.id !== draftId),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['author-drafts', stakeAddress], context.previous);
      }
      toastError('Failed to archive draft');
    },

    onSuccess: () => {
      toastSuccess('Draft archived');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['author-drafts', stakeAddress] });
    },
  });
}

// ---------------------------------------------------------------------------
// Unarchive (via stage endpoint, transition back to draft)
// ---------------------------------------------------------------------------

export function useUnarchiveDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ draft: ProposalDraft }, Error, { draftId: string }, { previous: unknown }>({
    mutationFn: ({ draftId }) =>
      patchJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}/stage`, {
        targetStatus: 'draft',
      }),

    onMutate: async ({ draftId }) => {
      const queryKey = ['author-drafts', stakeAddress];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      // Optimistically set status to draft
      queryClient.setQueryData(queryKey, (old: { drafts: ProposalDraft[] } | undefined) => {
        if (!old) return old;
        return {
          drafts: old.drafts.map((d) =>
            d.id === draftId ? { ...d, status: 'draft' as const } : d,
          ),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['author-drafts', stakeAddress], context.previous);
      }
      toastError('Failed to unarchive draft');
    },

    onSuccess: () => {
      toastSuccess('Draft restored');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['author-drafts', stakeAddress] });
    },
  });
}

// ---------------------------------------------------------------------------
// Duplicate
// TODO: Backend endpoint POST /api/workspace/drafts/[draftId]/duplicate
// is being built in parallel. This mutation calls the expected shape.
// ---------------------------------------------------------------------------

export function useDuplicateDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ draft: ProposalDraft }, Error, { draftId: string }>({
    mutationFn: ({ draftId }) =>
      postJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}/duplicate`, {}),

    onSuccess: () => {
      toastSuccess('Draft duplicated');
      queryClient.invalidateQueries({ queryKey: ['author-drafts', stakeAddress] });
    },

    onError: () => {
      toastError('Failed to duplicate draft');
    },
  });
}

// ---------------------------------------------------------------------------
// Delete
// TODO: Backend endpoint DELETE /api/workspace/drafts/[draftId]
// is being built in parallel. Only allowed when status === 'draft'.
// ---------------------------------------------------------------------------

export function useDeleteDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, { draftId: string }, { previous: unknown }>({
    mutationFn: ({ draftId }) =>
      deleteJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}`),

    onMutate: async ({ draftId }) => {
      const queryKey = ['author-drafts', stakeAddress];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      // Optimistically remove from list
      queryClient.setQueryData(queryKey, (old: { drafts: ProposalDraft[] } | undefined) => {
        if (!old) return old;
        return {
          drafts: old.drafts.filter((d) => d.id !== draftId),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['author-drafts', stakeAddress], context.previous);
      }
      toastError('Failed to delete draft');
    },

    onSuccess: () => {
      toastSuccess('Draft deleted');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['author-drafts', stakeAddress] });
    },
  });
}

// ---------------------------------------------------------------------------
// Export
// TODO: Backend endpoint GET /api/workspace/drafts/[draftId]/export?format=markdown|cip108
// is being built in parallel. Downloads the file via blob URL.
// ---------------------------------------------------------------------------

export function useExportDraft() {
  return useMutation<void, Error, { draftId: string; format: 'markdown' | 'cip108' }>({
    mutationFn: async ({ draftId, format }) => {
      const blob = await fetchBlobWithAuth(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}/export?format=${format}`,
      );

      // Trigger browser download
      const ext = format === 'markdown' ? 'md' : 'json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-${draftId.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    onSuccess: () => {
      toastSuccess('Export downloaded');
    },

    onError: () => {
      toastError('Failed to export draft');
    },
  });
}
