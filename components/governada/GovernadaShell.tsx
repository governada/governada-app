'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { SegmentProvider, useSegment } from '@/components/providers/SegmentProvider';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { GovernadaHeader } from './GovernadaHeader';
import { GovernadaBottomNav } from './GovernadaBottomNav';
import { GovernadaSidebar } from './GovernadaSidebar';
import { SyncFreshnessBanner } from '@/components/SyncFreshnessBanner';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false },
);

const SpotlightProvider = dynamic(
  () =>
    import('@/components/discovery/SpotlightProvider').then((m) => ({
      default: m.SpotlightProvider,
    })),
  { ssr: false },
);

const DiscoveryHub = dynamic(
  () => import('@/components/discovery/DiscoveryHub').then((m) => ({ default: m.DiscoveryHub })),
  { ssr: false },
);

const EngagementNudge = dynamic(
  () =>
    import('@/components/discovery/EngagementNudge').then((m) => ({ default: m.EngagementNudge })),
  { ssr: false },
);

const MilestoneTrigger = dynamic(
  () =>
    import('@/components/discovery/MilestoneTrigger').then((m) => ({
      default: m.MilestoneTrigger,
    })),
  { ssr: false },
);

const SIDEBAR_STORAGE_KEY = 'governada_sidebar_collapsed';

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
        router.push('/governance/health');
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount for deep link handling
  }, []);

  return null;
}

/** Background globe — hidden on homepage only for anonymous users (who have their own hero globe in AnonymousLanding). */
function BackgroundGlobe({
  isHomepage,
  sidebarCollapsed,
}: {
  isHomepage: boolean;
  sidebarCollapsed: boolean;
}) {
  const { segment } = useSegment();
  // Hide the background globe on homepage for anonymous/not-yet-loaded users
  if (isHomepage && segment === 'anonymous') return null;
  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none z-0 transition-[left] duration-200',
        sidebarCollapsed ? 'lg:left-16' : 'lg:left-60',
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-30">
        <ConstellationScene interactive={false} className="w-full h-full" />
      </div>
      {/* Gradient fade — globe is most visible at top, fades toward bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-60% to-background" />
    </div>
  );
}

/**
 * Governada layout shell — sidebar on desktop, bottom bar on mobile.
 * Sidebar is persona-adaptive via the nav config.
 */
export function GovernadaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === 'true') setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <SegmentProvider>
      <TierThemeProvider score={null}>
        <Suspense fallback={null}>
          <DeepLinkHandler />
        </Suspense>
        <SyncFreshnessBanner />
        <GovernadaHeader />
        <GovernadaSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

        {/* Global constellation globe — subtle glassmorphic background */}
        <BackgroundGlobe isHomepage={isHomepage} sidebarCollapsed={sidebarCollapsed} />

        <main
          id="main-content"
          className={cn(
            'relative z-0 min-h-screen pb-16 lg:pb-0 transition-[padding-left] duration-200',
            sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
          )}
          tabIndex={-1}
        >
          {children}
        </main>
        <footer
          className={cn(
            'relative z-0 border-t border-border/40 py-4 px-4 text-center transition-[padding-left] duration-200',
            sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
          )}
        >
          <p className="text-xs text-muted-foreground/70">
            Governada is an independent community project and is not affiliated with, endorsed by,
            or associated with the Cardano Foundation, IOG, or EMURGO.
          </p>
        </footer>
        <GovernadaBottomNav />

        {/* Discovery Layer — lazy-loaded, zero impact on initial render */}
        <SpotlightProvider>
          <DiscoveryHub />
          <EngagementNudge />
          <MilestoneTrigger />
        </SpotlightProvider>
      </TierThemeProvider>
    </SegmentProvider>
  );
}
