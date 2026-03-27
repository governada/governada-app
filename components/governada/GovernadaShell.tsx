'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { SegmentProvider, useSegment } from '@/components/providers/SegmentProvider';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { GovernadaHeader } from './GovernadaHeader';
import { GovernadaBottomNav } from './GovernadaBottomNav';
import { EdgeSwipeMenu } from './EdgeSwipeMenu';
import { ShortcutProvider } from './ShortcutProvider';
import { ShortcutOverlay } from './ShortcutOverlay';
import { SectionTransition } from './SectionTransition';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SyncFreshnessBanner } from '@/components/SyncFreshnessBanner';
import { PreviewBanner } from '@/components/preview/PreviewBanner';
import { FeedbackWidget } from '@/components/preview/FeedbackWidget';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useSentryContext } from '@/hooks/useSentryContext';
import { useSentryFeatureFlags } from '@/hooks/useSentryFeatureFlags';
import { useGovernanceTemperature } from '@/hooks/useGovernanceTemperature';
import { useSenecaThread } from '@/hooks/useSenecaThread';

// SenecaOrb removed — the globe IS Seneca's visual embodiment now

const SenecaThread = dynamic(
  () =>
    import('@/components/governada/SenecaThread').then((m) => ({
      default: m.SenecaThread,
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

// DiscoveryHub is a regular import (not lazy) because it wraps the header
// and provides context for the Compass icon. It's lightweight — just state +
// context provider. The heavy CompassPanel is inside a Sheet (renders on open).
import { DiscoveryHub } from '@/components/discovery/DiscoveryHub';

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
  governanceTint,
}: {
  isHomepage: boolean;
  governanceTint?: string;
}) {
  // Hide the background globe on homepage — anonymous users have their own hero globe
  // in AnonymousLanding, and authenticated users have InhabitedConstellation which
  // provides its own full-viewport globe that extends behind the header.
  if (isHomepage) return null;
  return (
    <div
      className="force-dark fixed inset-0 pointer-events-none z-0 constellation-globe-container"
      aria-hidden="true"
      style={
        governanceTint
          ? ({ '--governance-tint': governanceTint } as React.CSSProperties)
          : undefined
      }
    >
      {/* Higher opacity on homepage so the transparent header has visible stars behind it */}
      <div className={cn('absolute inset-0', isHomepage ? 'opacity-50' : 'opacity-30')}>
        <ConstellationScene interactive={false} className="w-full h-full" />
      </div>
      {/* Governance temperature ambient tint overlay */}
      {governanceTint && <div className="governance-tint-overlay" />}
      {/* Gradient fade — globe is most visible at top, fades toward bottom.
          On homepage the fade starts later so the header area shows stars clearly. */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-b to-background',
          isHomepage
            ? 'from-transparent via-transparent via-70%'
            : 'from-transparent via-transparent via-60%',
        )}
      />
    </div>
  );
}

/** Invisible component that syncs user segment and feature flags to Sentry. */
function SentryContextSync() {
  useSentryContext();
  useSentryFeatureFlags();
  return null;
}

/** Seneca Thread wrapper — renders the conversation panel. Globe is Seneca's visual embodiment. */
function SenecaOrbAndThread({
  seneca,
}: {
  seneca: ReturnType<typeof useSenecaThread>;
  isStudioMode: boolean;
}) {
  const { segment } = useSegment();
  const isAuthenticated = segment !== 'anonymous';

  return (
    <>
      {/* Floating Thread Panel */}
      <SenecaThread
        isOpen={seneca.isOpen}
        onClose={seneca.close}
        mode={seneca.mode}
        persona={seneca.persona}
        panelRoute={seneca.panelRoute}
        entityId={seneca.entityId}
        pendingQuery={seneca.pendingQuery}
        messages={seneca.messages}
        onStartConversation={seneca.startConversation}
        onStartResearch={seneca.startResearch}
        onStartMatch={seneca.startMatch}
        onReturnToIdle={seneca.returnToIdle}
        onAddMessage={seneca.addMessage}
        onUpdateLastAssistant={seneca.updateLastAssistant}
        onClearConversation={seneca.clearConversation}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}

/** Derive a page context key from the pathname for Seneca's contextual awareness. */
function derivePageContext(pathname: string): string | undefined {
  if (pathname === '/') return 'governance';
  if (pathname.startsWith('/governance/proposals') || pathname.startsWith('/proposal/'))
    return 'proposals';
  if (pathname.startsWith('/governance/representatives') || pathname.startsWith('/drep/'))
    return 'dreps';
  if (pathname.startsWith('/governance/treasury')) return 'treasury';
  if (pathname.startsWith('/governance/spos') || pathname.startsWith('/spo/')) return 'spos';
  if (pathname.startsWith('/match')) return 'match';
  if (pathname.startsWith('/my-gov') || pathname.startsWith('/you')) return 'you';
  if (pathname.startsWith('/governance/health')) return 'governance';
  return undefined;
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
  const temporalAdaptation = useFeatureFlag('temporal_adaptation') === true;
  // Seneca is always available — no feature flag gate. Individual features
  // within Seneca (research mode, etc.) can be gated separately.
  const mobileGesturesFlag = useFeatureFlag('mobile_gestures');
  const mobileGestures = mobileGesturesFlag === true;
  const { tintColor } = useGovernanceTemperature();
  const seneca = useSenecaThread();

  // Horizontal swipe navigation between Home/Governance/You (mobile only)
  useSwipeNavigation(mobileGestures && !isStudioMode);

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
          {/* Discovery context wraps everything so header Compass icon can open the panel */}
          <SpotlightProvider>
            <DiscoveryHub currentPage={derivePageContext(pathname)}>
              {!isStudioMode && <GovernadaHeader />}
              {/* Global constellation globe — subtle glassmorphic background */}
              {!isStudioMode && (
                <BackgroundGlobe
                  isHomepage={isHomepage}
                  governanceTint={temporalAdaptation ? tintColor : undefined}
                />
              )}
              <main
                id="main-content"
                className={cn(
                  'relative z-0 min-h-screen',
                  isStudioMode ? '' : 'pb-16 lg:pb-0',
                  // On homepage, pull content up behind the transparent header so the
                  // globe extends to the top of the viewport and peeks through
                  isHomepage && '-mt-10',
                )}
                tabIndex={-1}
              >
                {isStudioMode ? children : <SectionTransition>{children}</SectionTransition>}
              </main>
              {!isStudioMode && <EngagementNudge />}
              {!isStudioMode && <MilestoneTrigger />}
            </DiscoveryHub>
          </SpotlightProvider>
          {/* Seneca Orb + Thread — unified floating companion (always available) */}
          <SenecaOrbAndThread seneca={seneca} isStudioMode={isStudioMode} />

          {!isStudioMode && (
            <footer className="relative z-0 border-t border-border/40 py-4 px-4 text-center">
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
