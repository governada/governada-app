'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProposalNote } from '@/lib/workspace/types';

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

async function fetchNote(
  userId: string,
  txHash: string,
  index: number,
): Promise<ProposalNote | null> {
  const headers = await fetchHeaders();
  const params = new URLSearchParams({
    proposalTxHash: txHash,
    proposalIndex: String(index),
  });
  const res = await fetch(`/api/workspace/notes?${params}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const { note } = await res.json();
  return note ?? null;
}

export function useProposalNote(
  userId: string | null | undefined,
  txHash: string | null | undefined,
  index: number | null | undefined,
) {
  return useQuery<ProposalNote | null>({
    queryKey: ['proposal-note', userId, txHash, index],
    queryFn: () => fetchNote(userId!, txHash!, index!),
    enabled: !!userId && !!txHash && index !== null && index !== undefined,
    staleTime: 60_000,
  });
}

interface SaveNoteInput {
  proposalTxHash: string;
  proposalIndex: number;
  noteText: string;
  highlights?: Array<{ start: number; end: number; color?: string; comment?: string }>;
}

export function useSaveNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveNoteInput) => {
      const headers = await fetchHeaders();
      const res = await fetch('/api/workspace/notes', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { note } = await res.json();
      return note as ProposalNote;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['proposal-note'],
        predicate: (query) => {
          const key = query.queryKey;
          return key[2] === variables.proposalTxHash && key[3] === variables.proposalIndex;
        },
      });
    },
  });
}
