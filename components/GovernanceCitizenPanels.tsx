'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { WatchlistIntelligence } from '@/components/WatchlistIntelligence';
import { FeatureGate } from '@/components/FeatureGate';
import { DRepCommunicationFeed } from '@/components/DRepCommunicationFeed';

export function GovernanceCitizenPanels() {
  const { isAuthenticated, delegatedDrepId, reconnecting } = useWallet();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (reconnecting || !isAuthenticated) return;

    const token = getStoredSession();
    if (!token) {
      setLoaded(true);
      return;
    }

    fetch('/api/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.watchlist) setWatchlist(data.watchlist);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [isAuthenticated, reconnecting]);

  if (!isAuthenticated || !loaded) return null;

  return (
    <>
      <FeatureGate flag="watchlist">
        <WatchlistIntelligence watchlist={watchlist} currentDrepId={delegatedDrepId} />
      </FeatureGate>
      {delegatedDrepId && <DRepCommunicationFeed drepId={delegatedDrepId} />}
    </>
  );
}
