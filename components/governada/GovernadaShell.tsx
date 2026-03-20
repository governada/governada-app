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
import { NavigationRail } from './NavigationRail';
import { EdgeSwipeMenu } from './EdgeSwipeMenu';
import { ShortcutProvider } from './ShortcutProvider';
import { ShortcutOverlay } from './ShortcutOverlay';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SyncFreshnessBanner } from '@/components/SyncFreshnessBanner';
import { PreviewBanner } from '@/components/preview/PreviewBanner';
import { FeedbackWidget } from '@/components/preview/FeedbackWidget';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useSentryContext } from '@/hooks/useSentryContext';
import { useSentryFeatureFlags } from '@/hooks/useSentryFeatureFlags';
import { useGovernanceTemperature } from '@/hooks/useGovernanceTemperature';
import { useIntelligencePanel } from '@/hooks/useIntelligencePanel';

const IntelligencePanel = dynamic(
  () =>
    import('@/components/governada/IntelligencePanel').then((m) => ({
      default: m.IntelligencePanel,
    })),
  { ssr: false },
);

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
  useRail,
  governanceTint,
}: {
  isHomepage: boolean;
  sidebarCollapsed: boolean;
  useRail?: boolean;
  governanceTint?: string;
}) {
  const { segment } = useSegment();
  // Hide the background globe on homepage for anonymous/not-yet-loaded users
  if (isHomepage && segment === 'anonymous') return null;
  return (
    <div
      className={cn(
        'force-dark fixed inset-0 pointer-events-none z-0 constellation-globe-container',
        useRail
          ? 'lg:left-12'
          : cn('transition-[left] duration-200', sidebarCollapsed ? 'lg:left-16' : 'lg:left-60'),
      )}
      aria-hidden="true"
      style={
        governanceTint
          ? ({ '--governance-tint': governanceTint } as React.CSSProperties)
          : undefined
      }
    >
      <div className="absolute inset-0 opacity-30">
        <ConstellationScene interactive={false} className="w-full h-full" />
      </div>
      {/* Governance temperature ambient tint overlay */}
      {governanceTint && <div className="governance-tint-overlay" />}
      {/* Gradient fade — globe is most visible at top, fades toward bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-60% to-background" />
    </div>
  );
}

/** Invisible component that syncs user segment and feature flags to Sentry. */
function SentryContextSync() {
  useSentryContext();
  useSentryFeatureFlags();
  return null;
}

/**
 * Governada layout shell — sidebar on desktop, bottom bar on mobile.
 * Sidebar is persona-adaptive via the nav config.
 */
export function GovernadaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const isHomepage = pathname === '/';
  const isStudioMode =
    pathname === '/workspace/review' ||
    /^\/workspace\/(author|editor|amendment)\/[^/]+/.test(pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigationRailFlag = useFeatureFlag('navigation_rail');
  const navigationRail = navigationRailFlag === true;
  const temporalAdaptation = useFeatureFlag('temporal_adaptation') === true;
  const governanceCopilotFlag = useFeatureFlag('governance_copilot');
  const showCopilot = governanceCopilotFlag === true && !isStudioMode;
  const mobileGesturesFlag = useFeatureFlag('mobile_gestures');
  const mobileGestures = mobileGesturesFlag === true;
  const { tintColor } = useGovernanceTemperature();
  const intelligencePanel = useIntelligencePanel();
  const panelVisible = showCopilot && intelligencePanel.isOpen && intelligencePanel.canShowPanel;

  // Horizontal swipe navigation between Home/Governance/You (mobile only)
  useSwipeNavigation(mobileGestures && !isStudioMode);

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
        <ShortcutProvider>
          <SentryContextSync />
          <Suspense fallback={null}>
            <DeepLinkHandler />
          </Suspense>
          <SyncFreshnessBanner />
          <PreviewBanner />
          {!isStudioMode && <GovernadaHeader />}
          {!isStudioMode &&
            (navigationRail ? (
              <NavigationRail
                onToggleCopilot={showCopilot ? intelligencePanel.toggle : undefined}
                copilotOpen={panelVisible}
              />
            ) : (
              <GovernadaSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
            ))}

          {/* Global constellation globe — subtle glassmorphic background */}
          {!isStudioMode && (
            <BackgroundGlobe
              isHomepage={isHomepage}
              sidebarCollapsed={sidebarCollapsed}
              useRail={navigationRail}
              governanceTint={temporalAdaptation ? tintColor : undefined}
            />
          )}

          {/* Discovery context wraps main so studio can access it */}
          <SpotlightProvider>
            <DiscoveryHub hideFab={isStudioMode}>
              <main
                id="main-content"
                className={cn(
                  'relative z-0 min-h-screen',
                  isStudioMode ? '' : 'pb-16 lg:pb-0',
                  isStudioMode
                    ? ''
                    : navigationRail
                      ? 'lg:pl-12'
                      : cn(
                          'transition-[padding-left] duration-200',
                          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
                        ),
                )}
                style={panelVisible ? { paddingRight: intelligencePanel.panelWidth } : undefined}
                tabIndex={-1}
              >
                {children}
              </main>
              {!isStudioMode && <EngagementNudge />}
              {!isStudioMode && <MilestoneTrigger />}
            </DiscoveryHub>
          </SpotlightProvider>
          {/* Governance Co-Pilot Intelligence Panel */}
          {showCopilot && intelligencePanel.canShowPanel && (
            <IntelligencePanel
              isOpen={intelligencePanel.isOpen}
              onClose={intelligencePanel.close}
              panelWidth={intelligencePanel.panelWidth}
            />
          )}

          {!isStudioMode && (
            <footer
              className={cn(
                'relative z-0 border-t border-border/40 py-4 px-4 text-center',
                navigationRail
                  ? 'lg:pl-12'
                  : cn(
                      'transition-[padding-left] duration-200',
                      sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
                    ),
              )}
            >
              <p className="text-xs text-muted-foreground/70">
                {t(
                  'Governada is an independent community project and is not affiliated with, endorsed by, or associated with the Cardano Foundation, IOG, or EMURGO.',
                )}
              </p>
            </footer>
          )}
          {!isStudioMode && <GovernadaBottomNav />}
          {!isStudioMode && mobileGestures && <EdgeSwipeMenu enabled={mobileGestures} />}
          <FeedbackWidget />
          <ShortcutOverlay />
        </ShortcutProvider>
      </TierThemeProvider>
    </SegmentProvider>
  );
}
