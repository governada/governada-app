'use client';

import { useState, useEffect } from 'react';
import { ProposalWithVoteSummary } from '@/lib/data';
import { ProposalsListClient } from '@/components/ProposalsListClient';

const WATCHLIST_KEY = 'drepscore_watchlist';

function getLocalWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

interface ProposalsPageClientProps {
  proposals: ProposalWithVoteSummary[];
  currentEpoch: number;
}

export function ProposalsPageClient({ proposals, currentEpoch }: ProposalsPageClientProps) {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setWatchlist(getLocalWatchlist());
  }, []);

  return (
    <ProposalsListClient proposals={proposals} watchlist={watchlist} currentEpoch={currentEpoch} />
  );
}
