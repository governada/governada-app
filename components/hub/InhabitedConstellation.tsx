'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { useIntelligencePanel } from '@/hooks/useIntelligencePanel';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationFlyIn } from '@/hooks/useConstellationFlyIn';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

const MobileConstellationView = dynamic(
  () => import('./MobileConstellationView').then((m) => ({ default: m.MobileConstellationView })),
  { ssr: false },
);

/**
 * Check if the briefing has already been shown this epoch-day.
 * Returns true if briefing should be triggered.
 */
function shouldShowBriefing(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `governada_briefing_${today}`;
    const shown = sessionStorage.getItem(key);
    if (shown) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true; // can't access sessionStorage, show anyway
  }
}

/**
 * InhabitedConstellation — The globe-centric authenticated homepage.
 *
 * The user's node is placed in the constellation at their alignment position.
 * Camera flies in to their position on load. Seneca panel auto-opens for briefing.
 * Globe is full-viewport — no cards, no hero section. The globe IS the homepage.
 */
export function InhabitedConstellation() {
  const globeRef = useRef<ConstellationRef>(null);
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const briefingTriggered = useRef(false);

  // Detect mobile viewport
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // User's constellation node — positioned by alignment
  const { userNode, delegationBond, userAlignments } = useUserConstellationNode();

  // Active proposals as globe nodes
  const { proposalNodes } = useConstellationProposals(userAlignments ?? undefined);

  // Camera fly-in state machine
  const { onGlobeReady, isSettled } = useConstellationFlyIn(globeRef, userNode);

  // Intelligence panel — auto-open when settled
  const { open: openPanel, isOpen: panelOpen, startConversation } = useIntelligencePanel();

  // Auto-open Seneca panel after fly-in settles
  useEffect(() => {
    if (isSettled && !panelOpen) {
      openPanel();
    }
  }, [isSettled, panelOpen, openPanel]);

  // Auto-trigger briefing once per epoch-day after panel opens
  useEffect(() => {
    if (!isSettled || !panelOpen || briefingTriggered.current) return;
    if (!shouldShowBriefing()) return;
    briefingTriggered.current = true;

    // Brief delay for panel animation to settle
    const timer = setTimeout(() => {
      startConversation('Brief me on governance');
    }, 800);
    return () => clearTimeout(timer);
  }, [isSettled, panelOpen, startConversation]);

  // Bridge globe node clicks to Seneca panel
  const { handleNodeClick, executeGlobeCommand } = useSenecaGlobeBridge(globeRef);

  // Listen for globe commands from Seneca panels (CustomEvent bridge)
  useEffect(() => {
    function handleGlobeCommand(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail) executeGlobeCommand(detail);
    }
    window.addEventListener('senecaGlobeCommand', handleGlobeCommand);
    return () => window.removeEventListener('senecaGlobeCommand', handleGlobeCommand);
  }, [executeGlobeCommand]);

  // Governance narrative data — drives atmosphere
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

  // Mobile fallback: 2D radial gravitational field
  if (isMobile) {
    return (
      <MobileConstellationView
        userNode={userNode}
        proposalNodes={proposalNodes}
        delegationBond={delegationBond}
        participation={50}
        deliberation={30}
        impact={20}
      />
    );
  }

  return (
    <div className="relative min-h-[100dvh]">
      {/* Living Globe — fills entire viewport, user inhabits the constellation */}
      <div className="absolute inset-0 sm:-mt-14 overflow-hidden">
        <ConstellationScene
          ref={globeRef}
          className="w-full h-full"
          interactive
          breathing={!prefersReducedMotion}
          healthScore={narrativeData?.healthScore ?? 75}
          urgency={narrativeData?.urgency ?? 30}
          initialCameraPosition={[0, 3, 22]}
          onReady={onGlobeReady}
          onNodeSelect={handleNodeClick}
          onNodeHover={handleNodeHover}
          onNodeHoverScreen={handleNodeHoverScreen}
          userNode={userNode}
          proposalNodes={proposalNodes}
          delegationBond={delegationBond}
        />
      </div>

      {/* Cursor-following tooltip for globe nodes */}
      <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} />
    </div>
  );
}
