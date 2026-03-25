'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GovernanceConsequenceCard } from './GovernanceConsequenceCard';
import { IntelligencePreview } from './IntelligencePreview';
import { ConversationalMatchFlow } from '@/components/matching/ConversationalMatchFlow';
import { CommunityPulse } from '@/components/intelligence/CommunityPulse';
import { useFeatureFlag } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

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
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const conversationalMatchingEnabled = useFeatureFlag('conversational_matching');
  const communityIntelligenceEnabled = useFeatureFlag('community_intelligence');

  // Fetch dynamic governance narrative
  const { data: narrativeData } = useQuery({
    queryKey: ['homepage-narrative'],
    queryFn: async () => {
      const res = await fetch('/api/homepage/narrative');
      if (!res.ok) return null;
      return res.json() as Promise<{ narrative: string; healthScore: number; urgency: number }>;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    trackFunnel(FUNNEL_EVENTS.LANDING_VIEWED);
  }, []);

  const handleMatchStart = () => {
    setIsMatching(true);
    trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'landing_conversational' });
  };

  const handleNodeHover = useCallback((node: ConstellationNode3D | null) => {
    setHoveredNode(node);
  }, []);

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
          <ConstellationScene
            ref={globeRef}
            className="w-full h-full"
            interactive={!isMatching}
            breathing={!prefersReducedMotion && !isMatching}
            healthScore={narrativeData?.healthScore ?? 75}
            urgency={narrativeData?.urgency ?? (pulseData?.activeProposals ?? 0) * 2}
            onNodeHover={!isMatching ? handleNodeHover : undefined}
          />
        </div>

        {/* Gradient fade — hidden when matching to keep immersion */}
        {!isMatching && (
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}

        {/* Hover card for globe nodes */}
        <AnimatePresence>
          {hoveredNode && !isMatching && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-white/10 bg-black/85 backdrop-blur-md px-4 py-3 shadow-2xl max-w-[280px]"
            >
              <p className="text-sm font-semibold text-white truncate">
                {hoveredNode.name || `${hoveredNode.id.slice(0, 12)}...`}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
                <span
                  className={
                    hoveredNode.nodeType === 'drep'
                      ? 'text-teal-400'
                      : hoveredNode.nodeType === 'spo'
                        ? 'text-violet-400'
                        : 'text-amber-400'
                  }
                >
                  {hoveredNode.nodeType === 'drep'
                    ? 'DRep'
                    : hoveredNode.nodeType === 'spo'
                      ? 'SPO'
                      : 'CC'}
                </span>
                <span>
                  Score <strong className="text-white/90">{hoveredNode.score}</strong>
                </span>
              </div>
              <p className="text-[10px] text-white/40 mt-1">Click to explore</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic governance narrative — below hero text, above match flow */}
        {!isMatching && narrativeData?.narrative && (
          <div className="absolute bottom-8 left-0 right-0 z-10 pointer-events-none flex justify-center px-6">
            <p
              className="text-xs sm:text-sm text-white/50 text-center max-w-md"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
            >
              {narrativeData.narrative}
            </p>
          </div>
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
