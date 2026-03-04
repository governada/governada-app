'use client';

import { useWallet } from '@/utils/wallet';
import { useUser } from '@/hooks/queries';
import { WatchlistIntelligence } from '@/components/WatchlistIntelligence';

import { DRepCommunicationFeed } from '@/components/DRepCommunicationFeed';

export function GovernanceCitizenPanels() {
  const { isAuthenticated, delegatedDrepId, reconnecting } = useWallet();
  const { data: userData, isLoading } = useUser();
  const watchlist = (userData as any)?.watchlist ?? [];

  if (!isAuthenticated || reconnecting || isLoading) return null;

  return (
    <>
      <WatchlistIntelligence watchlist={watchlist} currentDrepId={delegatedDrepId} />
      {delegatedDrepId && <DRepCommunicationFeed drepId={delegatedDrepId} />}
    </>
  );
}
