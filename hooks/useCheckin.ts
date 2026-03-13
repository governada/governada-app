'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';

interface CheckinResponse {
  streak: number;
  lastEpoch: number | null;
}

async function fetchCheckin(): Promise<CheckinResponse> {
  const token = getStoredSession();
  if (!token) return { streak: 0, lastEpoch: null };

  const res = await fetch('/api/you/checkin', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { streak: 0, lastEpoch: null };
  return res.json();
}

async function postCheckin(): Promise<void> {
  const token = getStoredSession();
  if (!token) return;

  await fetch('/api/you/checkin', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Records a hub check-in on mount and returns the current streak.
 * Idempotent — safe to call on every Hub render.
 */
export function useCheckin(enabled: boolean) {
  // Fire check-in POST on mount (fire-and-forget)
  const { mutate } = useMutation({ mutationFn: postCheckin });

  // Fetch streak data
  const { data } = useQuery<CheckinResponse>({
    queryKey: ['hub-checkin'],
    queryFn: fetchCheckin,
    enabled,
    staleTime: 60_000,
  });

  return {
    streak: data?.streak ?? 0,
    lastEpoch: data?.lastEpoch ?? null,
    recordCheckin: mutate,
  };
}
