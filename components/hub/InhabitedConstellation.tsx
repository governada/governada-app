'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { useIntelligencePanel } from '@/hooks/useIntelligencePanel';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
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

function shouldShowBriefing(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `governada_briefing_${today}`;
    const shown = sessionStorage.getItem(key);
    if (shown) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}

/**
 * InhabitedConstellation — The globe-centric authenticated homepage.
 *
 * Globe fills the viewport. User node is placed at alignment position.
 * Seneca opens automatically and starts a briefing once per day.
 * Fly-in is attempted but nothing else depends on it succeeding.
 */
export function InhabitedConstellation() {
  const globeRef = useRef<ConstellationRef>(null);
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const briefingTriggered = useRef(false);
  const flyInAttempted = useRef(false);

  // Detect mobile
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // User node + delegation bond
  const { userNode, delegationBond, userAlignments } = useUserConstellationNode();

  // Proposal nodes
  const { proposalNodes } = useConstellationProposals(userAlignments ?? undefined);

  // Intelligence panel
  const { open: openPanel, isOpen: panelOpen, startConversation } = useIntelligencePanel();

  // Bridge
  const { handleNodeClick, executeGlobeCommand } = useSenecaGlobeBridge(globeRef);

  // Globe commands from Seneca
  useEffect(() => {
    function handleGlobeCommand(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail) executeGlobeCommand(detail);
    }
    window.addEventListener('senecaGlobeCommand', handleGlobeCommand);
    return () => window.removeEventListener('senecaGlobeCommand', handleGlobeCommand);
  }, [executeGlobeCommand]);

  // Atmosphere data
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

  // --- Auto-open panel + briefing on simple timer (no dependency chain) ---
  useEffect(() => {
    const panelTimer = setTimeout(() => {
      if (!panelOpen) openPanel();
    }, 2000);
    return () => clearTimeout(panelTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!panelOpen || briefingTriggered.current) return;
    if (!shouldShowBriefing()) return;
    briefingTriggered.current = true;

    const timer = setTimeout(() => {
      startConversation('Brief me on governance');
    }, 1000);
    return () => clearTimeout(timer);
  }, [panelOpen, startConversation]);

  // --- Fly-in: attempt when globe is ready and user node exists ---
  const onGlobeReady = useCallback(() => {
    if (flyInAttempted.current || !userNode) return;
    flyInAttempted.current = true;

    setTimeout(() => {
      const globe = globeRef.current;
      if (!globe) return;
      globe.flyToNode(userNode.id).catch(() => {
        // fly-in failed — globe stays at orbit, which is fine
      });
    }, 800);
  }, [userNode]);

  // Also try fly-in when user node arrives after globe is already ready
  useEffect(() => {
    if (!userNode || flyInAttempted.current) return;
    // Small delay to let globe re-render with the user node
    const timer = setTimeout(() => {
      if (flyInAttempted.current) return;
      flyInAttempted.current = true;
      const globe = globeRef.current;
      if (!globe) return;
      globe.flyToNode(userNode.id).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [userNode]);

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
      <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} />
    </div>
  );
}
