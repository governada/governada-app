'use client';

import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function NetworkBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-center text-sm py-1.5 px-4">
      <WifiOff className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
      You&apos;re offline. Showing cached data.
    </div>
  );
}
