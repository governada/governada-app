'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReviewQueueResponse, QueueItemStatus } from '@/lib/workspace/types';

// ── Data fetching hook ─────────────────────────────────────────────────

async function fetchReviewQueue(voterId: string, voterRole: string): Promise<ReviewQueueResponse> {
  const headers: Record<string, string> = {};
  try {
    const { getStoredSession } = await import('@/lib/supabaseAuth');
    const token = getStoredSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // No session available
  }
  const res = await fetch(
    `/api/workspace/review-queue?voterId=${encodeURIComponent(voterId)}&voterRole=${encodeURIComponent(voterRole)}`,
    { headers },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useReviewQueue(voterId: string | null | undefined, voterRole: string = 'drep') {
  return useQuery<ReviewQueueResponse>({
    queryKey: ['review-queue', voterId, voterRole],
    queryFn: () => fetchReviewQueue(voterId!, voterRole),
    enabled: !!voterId,
    staleTime: 30_000,
  });
}

// ── Local queue state management ───────────────────────────────────────

const STORAGE_KEY = 'governada_review_queue_state';

interface QueueStateMap {
  [proposalKey: string]: {
    status: QueueItemStatus;
    voteChoice?: string;
    updatedAt: number;
  };
}

function loadQueueState(voterId: string): QueueStateMap {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${voterId}`);
    if (!raw) return {};
    return JSON.parse(raw) as QueueStateMap;
  } catch {
    return {};
  }
}

function saveQueueState(voterId: string, state: QueueStateMap) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${voterId}`, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

export function useQueueState(voterId: string | null) {
  const [stateMap, setStateMap] = useState<QueueStateMap>({});

  // Load from localStorage on mount
  useEffect(() => {
    if (!voterId) return;
    setStateMap(loadQueueState(voterId));
  }, [voterId]);

  const getStatus = useCallback(
    (txHash: string, proposalIndex: number): QueueItemStatus => {
      const key = `${txHash}-${proposalIndex}`;
      return stateMap[key]?.status ?? 'unreviewed';
    },
    [stateMap],
  );

  const setStatus = useCallback(
    (txHash: string, proposalIndex: number, status: QueueItemStatus, voteChoice?: string) => {
      if (!voterId) return;
      setStateMap((prev) => {
        const key = `${txHash}-${proposalIndex}`;
        const next = {
          ...prev,
          [key]: { status, voteChoice, updatedAt: Date.now() },
        };
        saveQueueState(voterId, next);
        return next;
      });
    },
    [voterId],
  );

  const reviewedCount = useCallback(
    (items: { txHash: string; proposalIndex: number }[]): number => {
      return items.filter((item) => {
        const key = `${item.txHash}-${item.proposalIndex}`;
        const entry = stateMap[key];
        return entry?.status === 'voted';
      }).length;
    },
    [stateMap],
  );

  return { getStatus, setStatus, reviewedCount };
}
