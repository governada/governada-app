'use client';

import { SegmentProvider } from '@/components/providers/SegmentProvider';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { CivicaHeader } from './CivicaHeader';
import { CivicaBottomNav } from './CivicaBottomNav';

/**
 * Civica layout shell — wraps children with 4-tab nav + providers.
 * Rendered by root layout when civica_frontend flag is on.
 */
export function CivicaShell({ children }: { children: React.ReactNode }) {
  return (
    <SegmentProvider>
      <TierThemeProvider score={null}>
        <CivicaHeader />
        <main id="main-content" className="min-h-screen pb-16 sm:pb-0" tabIndex={-1}>
          {children}
        </main>
        <CivicaBottomNav />
      </TierThemeProvider>
    </SegmentProvider>
  );
}
