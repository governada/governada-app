'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DecisionJournalEntry, JournalPosition } from '@/lib/workspace/types';

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

async function fetchJournalEntry(
  userId: string,
  txHash: string,
  index: number,
): Promise<DecisionJournalEntry | null> {
  const headers = await fetchHeaders();
  const params = new URLSearchParams({
    proposalTxHash: txHash,
    proposalIndex: String(index),
  });
  const res = await fetch(`/api/workspace/journal?${params}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const { entry } = await res.json();
  return entry ?? null;
}

export function useJournalEntry(
  userId: string | null | undefined,
  txHash: string | null | undefined,
  index: number | null | undefined,
) {
  return useQuery<DecisionJournalEntry | null>({
    queryKey: ['journal-entry', userId, txHash, index],
    queryFn: () => fetchJournalEntry(userId!, txHash!, index!),
    enabled: !!userId && !!txHash && index !== null && index !== undefined,
    staleTime: 60_000,
  });
}

interface SaveJournalInput {
  proposalTxHash: string;
  proposalIndex: number;
  position: JournalPosition;
  confidence: number;
  steelmanText?: string;
  keyAssumptions?: string;
  whatWouldChangeMind?: string;
}

export function useSaveJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveJournalInput) => {
      const headers = await fetchHeaders();
      const res = await fetch('/api/workspace/journal', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const { entry } = await res.json();
      return entry as DecisionJournalEntry;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['journal-entry'],
        predicate: (query) => {
          const key = query.queryKey;
          return key[2] === variables.proposalTxHash && key[3] === variables.proposalIndex;
        },
      });
    },
  });
}
