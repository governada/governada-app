'use client';

import { useState, useEffect } from 'react';
import { ProposalVoteDetail } from '@/lib/data';
import { ProposalVotersClient } from '@/components/ProposalVotersClient';
import { useWallet } from '@/utils/wallet';

const WATCHLIST_KEY = 'drepscore_watchlist';

function getLocalWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

interface Props {
  votes: ProposalVoteDetail[];
}

export function ProposalVotersWithContext({ votes }: Props) {
  const { delegatedDrepId } = useWallet();
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setWatchlist(getLocalWatchlist());
  }, []);

  return (
    <ProposalVotersClient votes={votes} watchlist={watchlist} delegatedDrepId={delegatedDrepId} />
  );
}
