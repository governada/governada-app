'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { BarChart3 } from 'lucide-react';
import { GovernanceConsequenceCard } from './GovernanceConsequenceCard';
import { IntelligencePreview } from './IntelligencePreview';
import { ConversationalMatchFlow } from '@/components/matching/ConversationalMatchFlow';
import { CommunityPulse } from '@/components/intelligence/CommunityPulse';
import { useFeatureFlag } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';
import type { ConstellationRef } from '@/components/GovernanceConstellation';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

interface AnonymousLandingProps {
  pulseData?: {
    activeProposals: number;
    activeDReps: number;
    totalDelegators: number;
  };
}

/**
 * Anonymous Landing — Optimized conversion page.
 *
 * When conversational matching is enabled, topic pills start the matching flow
 * inline. The below-fold content (Get Started, Intelligence, Community Pulse)
 * is completely unmounted when matching is active — creating a focused,
 * immersive "Xavier's Room" experience without navigating to a separate page.
 */
export function AnonymousLanding({ pulseData }: AnonymousLandingProps) {
  const { t } = useTranslation();
  const globeRef = useRef<ConstellationRef>(null);
  const [isMatching, setIsMatching] = useState(false);
  const conversationalMatchingEnabled = useFeatureFlag('conversational_matching');
  const communityIntelligenceEnabled = useFeatureFlag('community_intelligence');

  useEffect(() => {
    trackFunnel(FUNNEL_EVENTS.LANDING_VIEWED);
  }, []);

  const handleMatchStart = () => {
    setIsMatching(true);
    trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'landing_conversational' });
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Constellation hero — fills viewport when matching */}
      <section
        className={cn(
          'force-dark relative sm:-mt-14 overflow-visible flex items-start sm:items-center justify-center',
          'transition-all duration-700',
          isMatching
            ? 'min-h-[calc(100vh-4rem)] max-md:min-h-[calc(100dvh-4rem)]'
            : 'flex-1 min-h-[50vh]',
        )}
      >
        <div className="absolute inset-0 overflow-hidden">
          <ConstellationScene ref={globeRef} className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade — hidden when matching to keep immersion */}
        {!isMatching && (
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}

        {/* Hero content */}
        <div
          className={cn(
            'relative z-10 text-center px-6 pt-16 sm:pt-14 w-full flex flex-col',
            isMatching
              ? 'max-w-lg max-md:h-full max-md:justify-between max-md:pt-20 max-md:pb-0'
              : 'max-w-lg',
          )}
        >
          {/* Title — hides when matching starts */}
          {!isMatching && (
            <div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight hero-text-shadow">
                {t('Your ADA gives you')}
                <br />
                <span className="text-primary">{t('a voice.')}</span>
              </h1>
              <p
                className="mt-4 text-lg sm:text-xl text-white/90 font-medium"
                style={{
                  textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
                }}
              >
                {t('Choose who votes for you. It takes 60 seconds.')}
              </p>
            </div>
          )}

          {/* Conversational matching flow — inline, no navigation */}
          {conversationalMatchingEnabled && (
            <div className={cn('mt-8', isMatching && 'max-md:mt-auto')}>
              <ConversationalMatchFlow globeRef={globeRef} onMatchStart={handleMatchStart} />
            </div>
          )}
        </div>
      </section>

      {/* Below-fold content — fully UNMOUNTED when matching is active */}
      {!isMatching && (
        <section className="relative z-10 mx-auto w-full max-w-lg px-6 -mt-8 pb-12 space-y-6">
          {/* Original CTA cards — shown when conversational matching is disabled */}
          {!conversationalMatchingEnabled && (
            <div className="flex flex-col gap-3">
              <Button
                asChild
                size="lg"
                className="w-full gap-2 text-base py-6 rounded-xl font-semibold"
                onClick={() =>
                  trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'landing_primary' })
                }
              >
                <Link href="/match">
                  <Users className="h-5 w-5" />
                  {t('Choose Your Representative')}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          )}

          {/* Governance consequence card */}
          {pulseData && (
            <GovernanceConsequenceCard
              activeProposals={pulseData.activeProposals}
              totalDelegators={pulseData.totalDelegators}
            />
          )}

          {/* Get Started card */}
          <Link
            href="/get-started"
            className="block rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-xl p-4 space-y-2 transition-all duration-200 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
            onClick={() =>
              trackFunnel(FUNNEL_EVENTS.EXPLORE_CLICKED, { source: 'landing_get_started' })
            }
          >
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{t('Get Started')}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                'Connect your wallet to see personalized governance insights, track your delegation, and discover representatives aligned with your values.',
              )}
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary">
              {t('Learn how')} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          {/* Intelligence preview */}
          <IntelligencePreview />

          {/* Community Pulse */}
          {communityIntelligenceEnabled && (
            <div className="rounded-xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Community Pulse</span>
              </div>
              <CommunityPulse />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
