'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

// Cardano epoch constants (Shelley era)
const SHELLEY_GENESIS = 1596491091;
const EPOCH_LENGTH = 432000; // 5 days in seconds
const SHELLEY_BASE_EPOCH = 209;

function computeCurrentEpoch() {
  const now = Math.floor(Date.now() / 1000);
  return Math.floor((now - SHELLEY_GENESIS) / EPOCH_LENGTH) + SHELLEY_BASE_EPOCH;
}

function computeEpochDay() {
  const now = Math.floor(Date.now() / 1000);
  const epochStart = SHELLEY_GENESIS + (computeCurrentEpoch() - SHELLEY_BASE_EPOCH) * EPOCH_LENGTH;
  const secondsIntoEpoch = now - epochStart;
  return Math.floor(secondsIntoEpoch / 86400) + 1; // 1-indexed
}

export interface EpochContext {
  epoch: number;
  day: number; // 1-5
  totalDays: 5;
  activeProposalCount: number | null;
  isLoading: boolean;
}

/**
 * Lightweight epoch context for the EpochContextBar.
 * Epoch/day computed client-side (no API call needed).
 * Proposal count fetched from existing proposals endpoint.
 */
export function useEpochContext(): EpochContext {
  const epoch = useMemo(() => computeCurrentEpoch(), []);
  const day = useMemo(() => computeEpochDay(), []);

  // Fetch just proposal count — reuses the same queryKey as useProposals
  // so if proposals are already cached, this is free.
  const { data, isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: async () => {
      const res = await fetch('/api/proposals');
      if (!res.ok) throw new Error('Failed to fetch proposals');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (d: { proposals?: unknown[] }) => d?.proposals?.length ?? null,
  });

  return {
    epoch,
    day,
    totalDays: 5,
    activeProposalCount: typeof data === 'number' ? data : null,
    isLoading,
  };
}
