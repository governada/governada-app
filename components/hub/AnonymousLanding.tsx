'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { useSenecaThread } from '@/hooks/useSenecaThread';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import type { ConstellationRef } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { useGlobeCommandListener } from '@/hooks/useGlobeCommandListener';

const SenecaMatch = dynamic(
  () =>
    import('@/components/governada/panel/SenecaMatch').then((m) => ({ default: m.SenecaMatch })),
  { ssr: false },
);

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
  filter?: string;
  entity?: string;
  match?: boolean;
}

/**
 * Anonymous Landing — Full-viewport living globe with Seneca dock.
 *
 * The globe fills the entire viewport. The only UI chrome is the
 * Seneca dock at bottom-left and the globe hover tooltips.
 * This is the immersive entry point into Governada.
 */
export function AnonymousLanding({ pulseData }: AnonymousLandingProps) {
  const router = useRouter();
  const globeRef = useRef<ConstellationRef>(null);
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { startMatch, mode: senecaMode, returnToIdle } = useSenecaThread();

  // Bridge globe node clicks to Seneca panel
  const bridge = useSenecaGlobeBridge(globeRef);
  const { handleNodeClick, executeGlobeCommand } = bridge;

  // Listen for globe commands from Seneca (via centralized command bus)
  useGlobeCommandListener(bridge);

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

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, screenPos: { x: number; y: number } | null) => {
      setHoveredNode(node);
      setHoverScreenPos(screenPos);
    },
    [],
  );

  // Listen for "Find your match" CTA clicks from tooltip cards
  useEffect(() => {
    function handleStartMatch() {
      startMatch();
      trackFunnel(FUNNEL_EVENTS.MATCH_STARTED, { source: 'globe_tooltip_cta' });
    }
    window.addEventListener('startSenecaMatch', handleStartMatch);
    return () => window.removeEventListener('startSenecaMatch', handleStartMatch);
  }, [startMatch]);

  // Match result overlay is rendered by SenecaMatch via portal (works for both anon + auth)

  return (
    <div className="relative min-h-[100dvh]">
      {/* Living Globe — fills entire viewport */}
      <div className="absolute inset-0 sm:-mt-14 overflow-hidden">
        <ConstellationScene
          ref={globeRef}
          className="w-full h-full"
          interactive
          breathing={!prefersReducedMotion}
          healthScore={narrativeData?.healthScore ?? 75}
          urgency={narrativeData?.urgency ?? (pulseData?.activeProposals ?? 0) * 2}
          initialCameraPosition={[0, 1.5, 16]}
          onNodeSelect={handleNodeClick}
          onNodeHover={handleNodeHover}
          onNodeHoverScreen={handleNodeHoverScreen}
        />
      </div>

      {/* Cursor-following tooltip for globe nodes */}
      <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} showMatchCta />

      {/* Globe IS Seneca — the Seneca Orb + Thread handles entry from GovernadaShell on non-homepage pages */}

      {/* Match flow panel — appears when match is triggered */}
      {senecaMode === 'matching' && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-6 z-50 w-[min(440px,calc(100vw-3rem))] max-h-[70vh] backdrop-blur-xl bg-background/50 border border-white/5 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:rounded-b-none max-md:rounded-t-xl max-md:max-h-[70vh] max-md:backdrop-blur-none max-md:bg-background/90"
        >
          <SenecaMatch onBack={returnToIdle} />
        </motion.div>
      )}

      {/* Subtle scroll escape hatch — bottom center */}
      <motion.button
        initial={prefersReducedMotion ? { opacity: 0.5 } : { opacity: 0, y: 5 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ delay: 2, duration: 0.6 }}
        whileHover={{ opacity: 0.8 }}
        onClick={() => router.push('/?filter=proposals')}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-0.5 text-white/40 hover:text-white/70 transition-colors pointer-events-auto"
      >
        <span className="text-[10px] tracking-wider uppercase">Explore governance</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </motion.button>
    </div>
  );
}
