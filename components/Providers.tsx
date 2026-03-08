'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { WalletProvider } from '@/utils/wallet';
import { initPostHog } from '@/lib/posthog';
import { getQueryClient } from '@/lib/queryClient';
import { NetworkBanner } from '@/components/NetworkBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <NetworkBanner />
        {children}
      </WalletProvider>
    </QueryClientProvider>
  );
}
