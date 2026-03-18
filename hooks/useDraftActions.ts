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
  const queryFilter = { queryKey: ['author-drafts', stakeAddress] };

  return useMutation<
    { draft: ProposalDraft },
    Error,
    { draftId: string },
    { snapshots: [readonly unknown[], unknown][] }
  >({
    mutationFn: ({ draftId }) =>
      patchJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}/stage`, {
        targetStatus: 'archived',
      }),

    onMutate: async ({ draftId }) => {
      await queryClient.cancelQueries(queryFilter);
      const snapshots = queryClient.getQueriesData<{ drafts: ProposalDraft[] }>(queryFilter);

      // Optimistically remove from all matching draft lists
      queryClient.setQueriesData<{ drafts: ProposalDraft[] }>(queryFilter, (old) => {
        if (!old) return old;
        return { drafts: old.drafts.filter((d) => d.id !== draftId) };
      });

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toastError('Failed to archive draft');
    },

    onSuccess: () => {
      toastSuccess('Draft archived');
    },

    onSettled: () => {
      queryClient.invalidateQueries(queryFilter);
    },
  });
}

// ---------------------------------------------------------------------------
// Unarchive (via stage endpoint, transition back to draft)
// ---------------------------------------------------------------------------

export function useUnarchiveDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();
  const queryFilter = { queryKey: ['author-drafts', stakeAddress] };

  return useMutation<
    { draft: ProposalDraft },
    Error,
    { draftId: string },
    { snapshots: [readonly unknown[], unknown][] }
  >({
    mutationFn: ({ draftId }) =>
      patchJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}/stage`, {
        targetStatus: 'draft',
      }),

    onMutate: async ({ draftId }) => {
      await queryClient.cancelQueries(queryFilter);
      const snapshots = queryClient.getQueriesData<{ drafts: ProposalDraft[] }>(queryFilter);

      // Optimistically set status to draft
      queryClient.setQueriesData<{ drafts: ProposalDraft[] }>(queryFilter, (old) => {
        if (!old) return old;
        return {
          drafts: old.drafts.map((d) =>
            d.id === draftId ? { ...d, status: 'draft' as const } : d,
          ),
        };
      });

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toastError('Failed to unarchive draft');
    },

    onSuccess: () => {
      toastSuccess('Draft restored');
    },

    onSettled: () => {
      queryClient.invalidateQueries(queryFilter);
    },
  });
}

// ---------------------------------------------------------------------------
// Duplicate
// POST /api/workspace/drafts/[draftId]/duplicate
// Body: { stakeAddress, titlePrefix? }
// ---------------------------------------------------------------------------

export function useDuplicateDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ draft: ProposalDraft }, Error, { draftId: string; titlePrefix?: string }>({
    mutationFn: ({ draftId, titlePrefix }) =>
      postJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}/duplicate`, {
        stakeAddress,
        ...(titlePrefix && { titlePrefix }),
      }),

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
// DELETE /api/workspace/drafts/[draftId]?stakeAddress=...
// Only allowed when status === 'draft'.
// ---------------------------------------------------------------------------

export function useDeleteDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();
  const queryFilter = { queryKey: ['author-drafts', stakeAddress] };

  return useMutation<
    { success: boolean },
    Error,
    { draftId: string },
    { snapshots: [readonly unknown[], unknown][] }
  >({
    mutationFn: ({ draftId }) =>
      deleteJsonWithAuth(
        `/api/workspace/drafts/${encodeURIComponent(draftId)}?stakeAddress=${encodeURIComponent(stakeAddress ?? '')}`,
      ),

    onMutate: async ({ draftId }) => {
      await queryClient.cancelQueries(queryFilter);
      const snapshots = queryClient.getQueriesData<{ drafts: ProposalDraft[] }>(queryFilter);

      // Optimistically remove from all matching draft lists
      queryClient.setQueriesData<{ drafts: ProposalDraft[] }>(queryFilter, (old) => {
        if (!old) return old;
        return { drafts: old.drafts.filter((d) => d.id !== draftId) };
      });

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toastError('Failed to delete draft');
    },

    onSuccess: () => {
      toastSuccess('Draft deleted');
    },

    onSettled: () => {
      queryClient.invalidateQueries(queryFilter);
    },
  });
}

// ---------------------------------------------------------------------------
// Export
// GET /api/workspace/drafts/[draftId]/export?format=markdown|cip108
// Downloads the file via blob URL.
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

// ---------------------------------------------------------------------------
// Transfer Ownership
// PATCH /api/workspace/drafts/[draftId]/transfer
// Body: { currentOwnerStakeAddress, newOwnerStakeAddress }
// ---------------------------------------------------------------------------

export function useTransferDraft(stakeAddress: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    { draft: ProposalDraft },
    Error,
    { draftId: string; newOwnerStakeAddress: string }
  >({
    mutationFn: ({ draftId, newOwnerStakeAddress }) =>
      patchJsonWithAuth(`/api/workspace/drafts/${encodeURIComponent(draftId)}/transfer`, {
        currentOwnerStakeAddress: stakeAddress,
        newOwnerStakeAddress,
      }),

    onSuccess: () => {
      toastSuccess('Ownership transferred');
      queryClient.invalidateQueries({ queryKey: ['author-drafts', stakeAddress] });
    },

    onError: () => {
      toastError('Failed to transfer ownership');
    },
  });
}
