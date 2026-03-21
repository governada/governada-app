'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { GovernanceConsequenceCard } from './GovernanceConsequenceCard';
import { IntelligencePreview } from './IntelligencePreview';
import { ConversationalMatchFlow } from '@/components/matching/ConversationalMatchFlow';
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
 * Two modes:
 * 1. Feature flag OFF: Original CTA cards (Choose Representative + Get Started)
 * 2. Feature flag ON: Conversational matching pills embedded in hero with globe convergence
 *
 * Enhanced social proof: live DRep, proposal, and participation counts.
 * Glass-window peek at governance health pulse to demonstrate value.
 * PostHog funnel instrumented at every interaction.
 */
export function AnonymousLanding({ pulseData }: AnonymousLandingProps) {
  const { t } = useTranslation();
  const globeRef = useRef<ConstellationRef>(null);
  const [isMatching, setIsMatching] = useState(false);
  const conversationalMatchingEnabled = useFeatureFlag('conversational_matching');

  useEffect(() => {
    trackFunnel(FUNNEL_EVENTS.LANDING_VIEWED);
  }, []);

  const handleMatchStart = () => {
    setIsMatching(true);
    trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'landing_conversational' });
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Constellation hero */}
      <section
        className={cn(
          'force-dark relative flex-1 min-h-[50vh] sm:-mt-14 overflow-hidden flex items-center justify-center',
          'transition-all duration-700',
          isMatching && 'min-h-[60vh]',
        )}
      >
        <div className="absolute inset-0">
          <ConstellationScene ref={globeRef} className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-lg px-6 sm:pt-14">
          <div
            className={cn(
              'transition-all duration-500',
              isMatching && 'opacity-0 h-0 overflow-hidden',
            )}
          >
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

          {/* Conversational matching pills — inline in hero when flag enabled */}
          {conversationalMatchingEnabled && (
            <div className="mt-8">
              <ConversationalMatchFlow globeRef={globeRef} onMatchStart={handleMatchStart} />
            </div>
          )}
        </div>
      </section>

      {/* CTAs + social proof — dims when matching starts */}
      <section
        className={cn(
          'relative z-10 mx-auto w-full max-w-lg px-6 -mt-8 pb-12 space-y-6',
          'transition-all duration-700',
          isMatching &&
            'opacity-20 translate-y-10 pointer-events-none md:opacity-20 md:translate-y-10',
          isMatching && 'max-md:hidden',
        )}
      >
        {/* Original CTA cards — shown when conversational matching is disabled */}
        {!conversationalMatchingEnabled && (
          <>
            {/* Primary CTA — Choose your representative */}
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
          </>
        )}

        {/* Spacer when conversational matching is enabled */}
        {conversationalMatchingEnabled && <div />}

        {/* Governance consequence card — why governance matters to your ADA */}
        {pulseData && !isMatching && (
          <GovernanceConsequenceCard
            activeProposals={pulseData.activeProposals}
            totalDelegators={pulseData.totalDelegators}
          />
        )}

        {/* Get Started card — encourage wallet connection */}
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

        {/* Intelligence preview — real AI headline from latest epoch briefing */}
        <IntelligencePreview />
      </section>
    </div>
  );
}
