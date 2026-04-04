'use client';

import { useState, useEffect } from 'react';
import { ProposalVoteDetail } from '@/lib/data';
import { STORAGE_KEYS, readStoredJson } from '@/lib/persistence';
import { ProposalVotersClient } from '@/components/ProposalVotersClient';
import { useWallet } from '@/utils/wallet';

function getLocalWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  return readStoredJson<string[]>(STORAGE_KEYS.watchlist, []);
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
