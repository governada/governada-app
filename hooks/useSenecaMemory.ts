'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';

interface ConversationSummary {
  summary: string;
  epoch: number;
  createdAt: string;
}

interface MemoryResponse {
  summaries: ConversationSummary[];
}

/**
 * Manages Seneca's conversation memory — fetching prior summaries and saving new ones.
 *
 * - `recentSummaries`: last 3 conversation summaries for system prompt injection
 * - `memoryContext`: pre-formatted string ready to inject into the advisor system prompt
 * - `saveConversation`: fire-and-forget mutation to summarize + store a conversation
 */
export function useSenecaMemory(isAuthenticated: boolean) {
  const queryClient = useQueryClient();

  // Fetch recent summaries — only for authenticated users
  const { data } = useQuery<MemoryResponse>({
    queryKey: ['seneca-memory'],
    queryFn: async () => {
      const token = getStoredSession();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/intelligence/memory', { headers });
      if (!res.ok) throw new Error('Failed to fetch memory');
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const recentSummaries = data?.summaries ?? [];

  // Format summaries for system prompt injection
  const memoryContext =
    recentSummaries.length > 0
      ? recentSummaries
          .map((s) => {
            const ago = getTimeAgo(s.createdAt);
            return `- ${ago} (Epoch ${s.epoch}): ${s.summary}`;
          })
          .join('\n')
      : undefined;

  // Mutation to save a conversation summary
  const saveMutation = useMutation({
    mutationFn: async (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      const token = getStoredSession();
      if (!token) return null;

      const res = await fetch('/api/intelligence/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (!res.ok) return null;
      return res.json();
    },
    onSuccess: () => {
      // Invalidate memory cache so next conversation picks up the new summary
      queryClient.invalidateQueries({ queryKey: ['seneca-memory'] });
    },
  });

  const saveConversation = useCallback(
    (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      // Only save conversations with actual substance (3+ exchanges)
      if (messages.length < 3) return;
      saveMutation.mutate(messages);
    },
    [saveMutation],
  );

  return {
    recentSummaries,
    memoryContext,
    saveConversation,
    isSaving: saveMutation.isPending,
  };
}

/** Format a timestamp as a human-readable relative time. */
function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)} weeks ago`;
}
