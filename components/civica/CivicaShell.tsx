'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SegmentProvider } from '@/components/providers/SegmentProvider';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { CivicaHeader } from './CivicaHeader';
import { CivicaBottomNav } from './CivicaBottomNav';

function DeepLinkHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;

    const period = searchParams.get('period');
    const txHash = searchParams.get('txHash');
    const index = searchParams.get('index');
    const drepId = searchParams.get('drepId');

    switch (action) {
      case 'view-wrapped':
        if (period) router.push(`/my-gov/wrapped/${period}`);
        break;
      case 'view-proposal':
        if (txHash && index) router.push(`/proposal/${txHash}/${index}`);
        break;
      case 'view-statement':
        if (drepId) router.push(`/drep/${encodeURIComponent(drepId)}`);
        break;
      case 'epoch-recap':
        router.push(`/pulse`);
        break;
    }
  }, []); // only on mount

  return null;
}

/**
 * Civica layout shell — wraps children with 4-tab nav + providers.
 * Rendered by root layout when civica_frontend flag is on.
 */
export function CivicaShell({ children }: { children: React.ReactNode }) {
  return (
    <SegmentProvider>
      <TierThemeProvider score={null}>
        <Suspense fallback={null}>
          <DeepLinkHandler />
        </Suspense>
        <CivicaHeader />
        <main id="main-content" className="relative z-0 min-h-screen pb-16 sm:pb-0" tabIndex={-1}>
          {children}
        </main>
        <CivicaBottomNav />
      </TierThemeProvider>
    </SegmentProvider>
  );
}
