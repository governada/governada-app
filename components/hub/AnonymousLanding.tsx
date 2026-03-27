'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { SenecaDock } from '@/components/governada/home/SenecaDock';
import { useSenecaThread } from '@/hooks/useSenecaThread';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
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
  const { startMatch } = useSenecaThread();

  // Bridge globe node clicks to Seneca panel
  const { handleNodeClick, executeGlobeCommand } = useSenecaGlobeBridge(globeRef);

  // Listen for globe commands from SenecaMatch panel (CustomEvent bridge)
  useEffect(() => {
    function handleGlobeCommand(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail) executeGlobeCommand(detail);
    }
    window.addEventListener('senecaGlobeCommand', handleGlobeCommand);
    return () => window.removeEventListener('senecaGlobeCommand', handleGlobeCommand);
  }, [executeGlobeCommand]);

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

      {/* Seneca Dock — warm welcome + "Find my representative" CTA */}
      <SenecaDock
        onStartMatch={startMatch}
        narrativePulse={narrativeData?.narrative}
        activeProposals={pulseData?.activeProposals}
      />

      {/* Subtle scroll escape hatch — bottom center */}
      <motion.button
        initial={prefersReducedMotion ? { opacity: 0.5 } : { opacity: 0, y: 5 }}
        animate={{ opacity: 0.5, y: 0 }}
        transition={{ delay: 2, duration: 0.6 }}
        whileHover={{ opacity: 0.8 }}
        onClick={() => router.push('/governance')}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-0.5 text-white/40 hover:text-white/70 transition-colors pointer-events-auto"
      >
        <span className="text-[10px] tracking-wider uppercase">Explore governance</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </motion.button>
    </div>
  );
}
