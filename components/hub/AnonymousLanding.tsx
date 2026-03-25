'use client';

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GovernanceConsequenceCard } from './GovernanceConsequenceCard';
import { IntelligencePreview } from './IntelligencePreview';
import { CommunityPulse } from '@/components/intelligence/CommunityPulse';
import { useFeatureFlag } from '@/components/FeatureGate';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

const MatchPromptPanel = lazy(() =>
  import('@/components/governada/match/MatchPromptPanel').then((m) => ({
    default: m.MatchPromptPanel,
  })),
);

interface AnonymousLandingProps {
  pulseData?: {
    activeProposals: number;
    activeDReps: number;
    totalDelegators: number;
  };
}

/**
 * Anonymous Landing — Living Globe with compact match panel.
 *
 * The globe is the hero — breathing, interactive, data-driven.
 * Match flow lives in a compact bottom-left panel that feels like
 * a search/prompt tool, not an onboarding quiz.
 */
export function AnonymousLanding({ pulseData }: AnonymousLandingProps) {
  const { t } = useTranslation();
  const globeRef = useRef<ConstellationRef>(null);
  const [matchPanelOpen, setMatchPanelOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const prefersReducedMotion = useReducedMotion();
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

  const handleNodeHover = useCallback((node: ConstellationNode3D | null) => {
    setHoveredNode(node);
  }, []);

  const handleAlignmentChange = useCallback((alignments: number[], threshold: number) => {
    globeRef.current?.highlightMatches(alignments, threshold);
  }, []);

  const handleMatchFound = useCallback((drepId: string) => {
    globeRef.current?.flyToMatch(drepId);
  }, []);

  const handleMatchClose = useCallback(() => {
    setMatchPanelOpen(false);
    globeRef.current?.clearMatches();
  }, []);

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Living Globe hero — fills viewport */}
      <section className="force-dark relative sm:-mt-14 overflow-visible flex-1 min-h-[65vh]">
        <div className="absolute inset-0 overflow-hidden">
          <ConstellationScene
            ref={globeRef}
            className="w-full h-full"
            interactive={!matchPanelOpen}
            breathing={!prefersReducedMotion}
            healthScore={narrativeData?.healthScore ?? 75}
            urgency={narrativeData?.urgency ?? (pulseData?.activeProposals ?? 0) * 2}
            onNodeHover={!matchPanelOpen ? handleNodeHover : undefined}
          />
        </div>

        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Hover card for globe nodes */}
        <AnimatePresence>
          {hoveredNode && !matchPanelOpen && (
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

        {/* Hero content — centered title + subtitle */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 pointer-events-none">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight hero-text-shadow text-center">
            {t('Your ADA gives you')}
            <br />
            <span className="text-primary">{t('a voice.')}</span>
          </h1>
          <p
            className="mt-4 text-lg sm:text-xl text-white/90 font-medium text-center"
            style={{
              textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {t('Choose who votes for you. It takes 60 seconds.')}
          </p>

          {/* Dynamic governance narrative */}
          {narrativeData?.narrative && (
            <p
              className="mt-6 text-xs sm:text-sm text-white/50 text-center max-w-md"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
            >
              {narrativeData.narrative}
            </p>
          )}
        </div>

        {/* Match CTA — floating button when panel is closed */}
        {!matchPanelOpen && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            onClick={() => {
              setMatchPanelOpen(true);
              trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'living_globe_cta' });
            }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 rounded-xl bg-primary/90 backdrop-blur-sm px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary transition-colors shadow-lg pointer-events-auto"
          >
            <Zap className="h-4 w-4" />
            {t('Find Your Match')}
          </motion.button>
        )}

        {/* Match prompt panel — compact bottom-left */}
        <AnimatePresence>
          {matchPanelOpen && (
            <Suspense fallback={null}>
              <MatchPromptPanel
                onAlignmentChange={handleAlignmentChange}
                onMatchFound={handleMatchFound}
                onClose={handleMatchClose}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </section>

      {/* Below-fold content — hidden when match panel is active */}
      {!matchPanelOpen && (
        <section className="relative z-10 mx-auto w-full max-w-lg px-6 -mt-8 pb-12 space-y-6">
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
