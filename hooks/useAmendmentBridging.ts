'use client';

import { useMutation } from '@tanstack/react-query';
import type { AmendmentBridgeOutput } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Fetch helpers (same pattern as hooks/useDrafts.ts)
// ---------------------------------------------------------------------------

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
// Mutation (on-demand, not auto-fetch)
// ---------------------------------------------------------------------------

interface BridgeResponse {
  output: AmendmentBridgeOutput;
  provenance: {
    skillName: string;
    model: string;
    keySource: 'platform' | 'byok';
    tokensUsed?: number;
    executedAt: string;
  };
}

/** Generate bridging statements for an amendment draft (on-demand). */
export function useAmendmentBridging(draftId: string | null) {
  return useMutation({
    mutationFn: () => {
      if (!draftId) throw new Error('draftId is required');
      return postJson<BridgeResponse>('/api/workspace/amendment-bridge', { draftId });
    },
  });
}
