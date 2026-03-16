'use client';

import { useQuery } from '@tanstack/react-query';

export interface CalendarUpcomingProposal {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  epochsLeft: number | null;
  daysLeft: number | null;
}

export interface GovernanceCalendarData {
  currentEpoch: number;
  secondsRemaining: number;
  epochProgress: number;
  upcoming: CalendarUpcomingProposal[];
}

async function fetchCalendar(): Promise<GovernanceCalendarData> {
  const res = await fetch('/api/governance/calendar');
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * useGovernanceCalendar — TanStack Query hook for epoch timing and expiring proposals.
 * staleTime: 60s (epochs change every 5 days but we want fresh countdown).
 */
export function useGovernanceCalendar() {
  return useQuery<GovernanceCalendarData>({
    queryKey: ['governance-calendar'],
    queryFn: fetchCalendar,
    staleTime: 60_000,
  });
}
