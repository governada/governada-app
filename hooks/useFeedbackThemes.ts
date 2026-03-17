'use client';

/**
 * Client hooks for the feedback consolidation system.
 *
 * - useFeedbackThemes() — fetches consolidated themes (respects sealed period)
 * - useEndorseTheme() — mutation to endorse (+1) a theme
 * - useAddressTheme() — mutation for proposer to address/defer/dismiss a theme
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { posthog } from '@/lib/posthog';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';

// ---------------------------------------------------------------------------
// Auth header helper (matches pattern from useAnnotations)
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
// Types
// ---------------------------------------------------------------------------

interface FeedbackThemesResponse {
  themes: FeedbackTheme[];
  isSealed: boolean;
}

interface EndorseInput {
  themeId: string;
  additionalContext?: string;
}

interface EndorseResult {
  endorsed: boolean;
  isNovel: boolean;
  newEndorsementCount: number;
}

interface AddressInput {
  themeId: string;
  action: 'addressed' | 'deferred' | 'dismissed';
  reason?: string;
}

interface AddressResult {
  updated: boolean;
  themeId: string;
  action: string;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

function feedbackKey(txHash: string | null | undefined, index: number | null | undefined) {
  return ['feedbackThemes', txHash, index] as const;
}

// ---------------------------------------------------------------------------
// Fetch themes
// ---------------------------------------------------------------------------

async function fetchThemes(txHash: string, index: number): Promise<FeedbackThemesResponse> {
  const headers = await fetchHeaders();
  const params = new URLSearchParams({
    proposalTxHash: txHash,
    proposalIndex: String(index),
  });
  const res = await fetch(`/api/workspace/feedback?${params}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch consolidated feedback themes for a proposal.
 * Returns themes + sealed state.
 */
export function useFeedbackThemes(
  txHash: string | null | undefined,
  index: number | null | undefined,
) {
  const query = useQuery<FeedbackThemesResponse>({
    queryKey: feedbackKey(txHash, index),
    queryFn: () => fetchThemes(txHash!, index!),
    enabled: !!txHash && index !== null && index !== undefined,
    staleTime: 30_000,
  });

  return {
    themes: query.data?.themes ?? [],
    isSealed: query.data?.isSealed ?? false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ---------------------------------------------------------------------------
// Endorse theme mutation
// ---------------------------------------------------------------------------

/**
 * Endorse a feedback theme (+1), optionally with additional context.
 * Automatically invalidates the feedback themes query on success.
 */
export function useEndorseTheme(
  txHash: string | null | undefined,
  index: number | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation<EndorseResult, Error, EndorseInput>({
    mutationFn: async (input: EndorseInput) => {
      const headers = await fetchHeaders();
      const res = await fetch('/api/workspace/feedback/endorse', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error ?? `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      posthog.capture('workspace_feedback_endorsed', {
        theme_id: variables.themeId,
        has_context: !!variables.additionalContext,
        proposal_tx_hash: txHash,
      });
      queryClient.invalidateQueries({ queryKey: feedbackKey(txHash, index) });
    },
  });
}

// ---------------------------------------------------------------------------
// Address theme mutation (proposer only)
// ---------------------------------------------------------------------------

/**
 * Proposer addresses a feedback theme (addressed/deferred/dismissed).
 * Automatically invalidates the feedback themes query on success.
 */
export function useAddressTheme(
  txHash: string | null | undefined,
  index: number | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation<AddressResult, Error, AddressInput>({
    mutationFn: async (input: AddressInput) => {
      const headers = await fetchHeaders();
      const res = await fetch('/api/workspace/feedback/address', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error ?? `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      posthog.capture('workspace_feedback_addressed', {
        theme_id: variables.themeId,
        action: variables.action,
        proposal_tx_hash: txHash,
      });
      queryClient.invalidateQueries({ queryKey: feedbackKey(txHash, index) });
    },
  });
}
