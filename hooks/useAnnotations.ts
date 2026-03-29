'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ProposalAnnotation,
  AnnotationType,
  AnnotationField,
  AnnotationStatus,
  SuggestedText,
} from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Auth header helper (reused pattern from useProposalNotes)
// ---------------------------------------------------------------------------

async function fetchHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Fetch annotations (own + public)
// ---------------------------------------------------------------------------

async function fetchAnnotations(txHash: string, index: number): Promise<ProposalAnnotation[]> {
  const headers = await fetchHeaders();
  const params = new URLSearchParams({
    proposalTxHash: txHash,
    proposalIndex: String(index),
  });
  const res = await fetch(`/api/workspace/annotations?${params}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const { annotations } = await res.json();
  return annotations ?? [];
}

export function useAnnotations(
  txHash: string | null | undefined,
  index: number | null | undefined,
) {
  return useQuery<ProposalAnnotation[]>({
    queryKey: ['annotations', txHash, index],
    queryFn: () => fetchAnnotations(txHash!, index!),
    enabled: !!txHash && index !== null && index !== undefined,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Create annotation
// ---------------------------------------------------------------------------

interface CreateAnnotationInput {
  proposalTxHash: string;
  proposalIndex: number;
  anchorStart: number;
  anchorEnd: number;
  anchorField: AnnotationField;
  annotationText: string;
  annotationType: AnnotationType;
  color?: string;
  isPublic?: boolean;
  suggestedText?: SuggestedText;
}

export function useCreateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnotationInput) => {
      const headers = await fetchHeaders();
      const res = await fetch('/api/workspace/annotations', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { annotation } = await res.json();
      return annotation as ProposalAnnotation;
    },
    onMutate: async (input) => {
      const key = ['annotations', input.proposalTxHash, input.proposalIndex];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProposalAnnotation[]>(key);

      // Optimistic add
      const optimistic: ProposalAnnotation = {
        id: `optimistic-${Date.now()}`,
        userId: 'current',
        proposalTxHash: input.proposalTxHash,
        proposalIndex: input.proposalIndex,
        anchorStart: input.anchorStart,
        anchorEnd: input.anchorEnd,
        anchorField: input.anchorField,
        annotationText: input.annotationText,
        annotationType: input.annotationType,
        color: input.color ?? null,
        isPublic: input.isPublic ?? (input.annotationType === 'suggestion' ? true : false),
        upvoteCount: 0,
        suggestedText: input.suggestedText ?? null,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<ProposalAnnotation[]>(key, [...(previous ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, input, context) => {
      if (context?.previous) {
        const key = ['annotations', input.proposalTxHash, input.proposalIndex];
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({
        queryKey: ['annotations', input.proposalTxHash, input.proposalIndex],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Update annotation
// ---------------------------------------------------------------------------

interface UpdateAnnotationInput {
  id: string;
  proposalTxHash: string;
  proposalIndex: number;
  annotationText?: string;
  isPublic?: boolean;
  color?: string;
  status?: AnnotationStatus;
}

export function useUpdateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAnnotationInput) => {
      const headers = await fetchHeaders();
      const res = await fetch('/api/workspace/annotations', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id: input.id,
          annotationText: input.annotationText,
          isPublic: input.isPublic,
          color: input.color,
          status: input.status,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { annotation } = await res.json();
      return annotation as ProposalAnnotation;
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({
        queryKey: ['annotations', input.proposalTxHash, input.proposalIndex],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete annotation
// ---------------------------------------------------------------------------

interface DeleteAnnotationInput {
  id: string;
  proposalTxHash: string;
  proposalIndex: number;
}

export function useDeleteAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteAnnotationInput) => {
      const headers = await fetchHeaders();
      const params = new URLSearchParams({ id: input.id });
      const res = await fetch(`/api/workspace/annotations?${params}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return true;
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({
        queryKey: ['annotations', input.proposalTxHash, input.proposalIndex],
      });
    },
  });
}
