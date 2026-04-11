'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { SegmentProvider, useSegment } from '@/components/providers/SegmentProvider';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { GovernadaHeader } from './GovernadaHeader';
import { GovernadaBottomNav } from './GovernadaBottomNav';
import { EdgeSwipeMenu } from './EdgeSwipeMenu';
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
import { useWhisper } from '@/hooks/useWhisper';
import { dispatchGlobeCommand } from '@/lib/globe/globeCommandBus';
import { useSenecaProactiveWhispers } from '@/hooks/useSenecaProactiveWhispers';
import { useEpochContext } from '@/hooks/useEpochContext';
import { LegalLinks } from './LegalLinks';
import { DiscoveryHub } from '@/components/discovery/DiscoveryHub';
import { SpotlightProvider } from '@/components/discovery/SpotlightProvider';

const SenecaOrb = dynamic(
  () =>
    import('@/components/governada/SenecaOrb').then((m) => ({
      default: m.SenecaOrb,
    })),
  { ssr: false },
);

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
        router.push('/');
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount for deep link handling
  }, []);

  return null;
}

function BackgroundGlobe({
  isHomepage,
  governanceTint,
}: {
  isHomepage: boolean;
  governanceTint?: string;
}) {
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
      <div className={cn('absolute inset-0', isHomepage ? 'opacity-50' : 'opacity-30')}>
        <ConstellationScene interactive={false} engineEnabled={false} className="w-full h-full" />
      </div>
      {governanceTint && <div className="governance-tint-overlay" />}
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

function SentryContextSync() {
  useSentryContext();
  useSentryFeatureFlags();
  return null;
}

function SenecaOrbAndThread({
  seneca,
  isStudioMode,
}: {
  seneca: ReturnType<typeof useSenecaThread>;
  isStudioMode: boolean;
}) {
  const { segment } = useSegment();
  const isAuthenticated = segment !== 'anonymous';
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const daysRemaining = totalDays - day;

  const pageContext = seneca.panelRoute === 'hub' ? 'homepage' : seneca.panelRoute;
  const { currentWhisper: templateWhisper, dismissWhisper: dismissTemplate } = useWhisper(
    pageContext,
    {
      activeProposals: activeProposalCount ?? undefined,
      epochProgress: epoch ? (day / totalDays) * 100 : undefined,
      daysRemaining,
      isAuthenticated,
    },
  );

  const { currentWhisper: proactiveWhisper, dismissWhisper: dismissProactive } =
    useSenecaProactiveWhispers(isAuthenticated, !isStudioMode);

  const currentWhisper = proactiveWhisper ?? templateWhisper;
  const dismissWhisper = proactiveWhisper ? dismissProactive : dismissTemplate;

  const sigilState =
    seneca.mode === 'matching'
      ? ('searching' as const)
      : seneca.mode === 'conversation'
        ? ('speaking' as const)
        : seneca.mode === 'research'
          ? ('thinking' as const)
          : ('idle' as const);

  const handleGlobeCommand = useCallback((cmd: unknown) => {
    dispatchGlobeCommand(cmd as import('@/lib/globe/types').GlobeCommand);
  }, []);

  return (
    <>
      {!seneca.isOpen && (
        <SenecaOrb
          onClick={seneca.toggle}
          sigilState={isStudioMode ? 'idle' : sigilState}
          accentColor={seneca.persona.accentColor}
          whisper={isStudioMode ? null : currentWhisper}
          onWhisperDismiss={dismissWhisper}
        />
      )}

      <SenecaThread
        isOpen={seneca.isOpen}
        onClose={seneca.close}
        mode={seneca.mode}
        persona={seneca.persona}
        panelRoute={seneca.panelRoute}
        world={seneca.world}
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
        onGlobeCommand={handleGlobeCommand}
        onEntityFocus={(entityType, entityId) => {
          handleGlobeCommand({ cmd: 'flyTo', target: `${entityType}:${entityId}` });
        }}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}

function derivePageContext(pathname: string): string | undefined {
  if (pathname === '/' || pathname === '/match') return 'governance';
  if (pathname.startsWith('/proposal/')) return 'proposals';
  if (pathname.startsWith('/drep/')) return 'dreps';
  if (pathname.startsWith('/pool/') || pathname.startsWith('/spo/')) return 'spos';
  if (pathname.startsWith('/committee/')) return 'governance';
  if (pathname.startsWith('/governance/')) return 'governance';
  if (pathname.startsWith('/my-gov') || pathname.startsWith('/you')) return 'you';
  return undefined;
}

/**
 * Shared public chrome. Private/app routes can layer additional providers via
 * their nested layouts instead of forcing those concerns onto every route.
 */
export function GovernadaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const isHomepage = pathname === '/' || pathname === '/match';
  const isStudioMode =
    pathname === '/workspace/review' ||
    /^\/workspace\/(author|editor|amendment)\/[^/]+/.test(pathname);
  const temporalAdaptation = useFeatureFlag('temporal_adaptation') === true;
  const mobileGestures = useFeatureFlag('mobile_gestures') === true;
  const { tintColor } = useGovernanceTemperature();
  const seneca = useSenecaThread();

  useSwipeNavigation(mobileGestures && !isStudioMode);

  return (
    <SegmentProvider>
      <TierThemeProvider score={null}>
        <SentryContextSync />
        <Suspense fallback={null}>
          <DeepLinkHandler />
        </Suspense>
        <SyncFreshnessBanner />
        <PreviewBanner />
        <SpotlightProvider>
          {!isStudioMode && <GovernadaHeader />}
          {!isStudioMode && (
            <BackgroundGlobe
              isHomepage={isHomepage}
              governanceTint={temporalAdaptation ? tintColor : undefined}
            />
          )}
          <main
            id="main-content"
            className={cn(
              'relative z-0',
              isStudioMode ? 'min-h-screen' : 'min-h-screen pb-16 lg:pb-0',
              isHomepage && '-mt-10',
            )}
            tabIndex={-1}
          >
            {isStudioMode ? children : <SectionTransition>{children}</SectionTransition>}
          </main>
          {!isStudioMode && <EngagementNudge />}
          {!isStudioMode && <MilestoneTrigger />}
        </SpotlightProvider>
        <SenecaOrbAndThread seneca={seneca} isStudioMode={isStudioMode} />
        <DiscoveryHub currentPage={derivePageContext(pathname)} />

        {!isStudioMode && (
          <footer className="relative z-0 border-t border-border/40 py-4 px-4 text-center">
            <p className="text-xs text-foreground/80">
              {t(
                'Governada is an independent community project and is not affiliated with, endorsed by, or associated with the Cardano Foundation, IOG, or EMURGO.',
              )}
            </p>
            <div className="mt-3 space-y-2">
              <LegalLinks />
              <p className="text-[11px] text-foreground/70">
                Analytics may be enabled in production deployments. See{' '}
                <Link
                  href="/privacy"
                  className="text-foreground/70 underline decoration-dotted underline-offset-2 hover:text-foreground"
                >
                  Privacy
                </Link>{' '}
                for the current telemetry baseline.
              </p>
            </div>
          </footer>
        )}
        {!isStudioMode && <GovernadaBottomNav />}
        {!isStudioMode && mobileGestures && <EdgeSwipeMenu enabled={mobileGestures} />}
        <FeedbackWidget />
      </TierThemeProvider>
    </SegmentProvider>
  );
}
