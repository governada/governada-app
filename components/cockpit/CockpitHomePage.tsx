'use client';

/**
 * CockpitHomePage — The Cockpit command center homepage.
 *
 * Replaces InhabitedConstellation when globe_homepage_v2 is enabled.
 * Full-viewport globe with HUD layers: StatusStrip, SenecaStrip,
 * ActionRail, OverlayTabs — all reactive via cockpitStore.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import { useCockpitStore } from '@/stores/cockpitStore';
import { StatusStrip } from './StatusStrip';
import { computeDensityLevel } from '@/lib/cockpit/types';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

const BOOT_SESSION_KEY = 'cockpit_booted';

export function CockpitHomePage() {
  const globeRef = useRef<ConstellationRef>(null);
  const [hoveredNode, setLocalHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const flyInAttempted = useRef(false);

  // Cockpit store
  const bootPhase = useCockpitStore((s) => s.bootPhase);
  const setBootPhase = useCockpitStore((s) => s.setBootPhase);
  const setDensityLevel = useCockpitStore((s) => s.setDensityLevel);
  const setStoreHoveredNode = useCockpitStore((s) => s.setHoveredNode);
  const markNodeVisited = useCockpitStore((s) => s.markNodeVisited);

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

  // Bridge: globe commands from Seneca
  const { handleNodeClick, executeGlobeCommand } = useSenecaGlobeBridge(globeRef);
  useEffect(() => {
    function handleGlobeCommand(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail) executeGlobeCommand(detail);
    }
    window.addEventListener('senecaGlobeCommand', handleGlobeCommand);
    return () => window.removeEventListener('senecaGlobeCommand', handleGlobeCommand);
  }, [executeGlobeCommand]);

  // Atmosphere data (health score + urgency for globe visuals)
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

  // Update density level from governance state
  const { data: govState } = useQuery({
    queryKey: ['governance-state-cockpit'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/governance-state');
      if (!res.ok) return null;
      return res.json() as Promise<{
        urgencyScore: number;
        temperatureScore: number;
        activeProposalCount: number;
        epoch: number;
        epochDay: number;
        epochTotalDays: number;
      }>;
    },
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (!govState) return;
    // Compute urgent count from action queue data — approximate from urgency score
    const urgentCount = Math.round((govState.urgencyScore / 100) * 10);
    setDensityLevel(computeDensityLevel(urgentCount, govState.temperatureScore));
  }, [govState, setDensityLevel]);

  // Boot sequence
  useEffect(() => {
    if (bootPhase !== 'pending') return;

    // Check if already booted this session
    try {
      if (sessionStorage.getItem(BOOT_SESSION_KEY)) {
        setBootPhase('ready');
        return;
      }
    } catch {
      // Ignore storage errors
    }

    if (prefersReducedMotion) {
      setBootPhase('ready');
      try {
        sessionStorage.setItem(BOOT_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      return;
    }

    // Start cascade
    setBootPhase('cascade');
    const readyTimer = setTimeout(() => {
      setBootPhase('ready');
      try {
        sessionStorage.setItem(BOOT_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
    }, 2500);

    return () => clearTimeout(readyTimer);
  }, [bootPhase, setBootPhase, prefersReducedMotion]);

  // Fly-in to user node
  const onGlobeReady = useCallback(() => {
    if (flyInAttempted.current || !userNode) return;
    flyInAttempted.current = true;
    setTimeout(() => {
      globeRef.current?.flyToNode(userNode.id).catch(() => {});
    }, 800);
  }, [userNode]);

  useEffect(() => {
    if (!userNode || flyInAttempted.current) return;
    const timer = setTimeout(() => {
      if (flyInAttempted.current) return;
      flyInAttempted.current = true;
      globeRef.current?.flyToNode(userNode.id).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [userNode]);

  // Node interaction handlers
  const handleNodeHover = useCallback(
    (node: ConstellationNode3D | null) => {
      setLocalHoveredNode(node);
      setStoreHoveredNode(node?.id ?? null);
    },
    [setStoreHoveredNode],
  );

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, screenPos: { x: number; y: number } | null) => {
      setLocalHoveredNode(node);
      setStoreHoveredNode(node?.id ?? null);
      setHoverScreenPos(screenPos);
    },
    [setStoreHoveredNode],
  );

  const handleNodeSelect = useCallback(
    (node: ConstellationNode3D) => {
      markNodeVisited(node.id);
      handleNodeClick(node);
    },
    [markNodeVisited, handleNodeClick],
  );

  // TODO: Phase 8 — render CockpitMobile for mobile
  if (isMobile) {
    // For now, render the same layout (mobile adaptation comes in Phase 8)
  }

  const isReady = bootPhase === 'ready';
  const isCascading = bootPhase === 'cascade';

  return (
    <div className="relative min-h-[100dvh]">
      {/* Globe canvas — fills viewport */}
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
          onNodeSelect={handleNodeSelect}
          onNodeHover={handleNodeHover}
          onNodeHoverScreen={handleNodeHoverScreen}
          userNode={userNode}
          proposalNodes={proposalNodes}
          delegationBond={delegationBond}
        />
      </div>

      {/* HUD overlay container — pointer-events-none by default, children opt in */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {/* Layer 2: Status Strip */}
        <div
          className="pointer-events-auto transition-all duration-500"
          style={{
            opacity: isReady || isCascading ? 1 : 0,
            transform:
              isCascading && !isReady
                ? 'translateY(-20px)'
                : isReady
                  ? 'translateY(0)'
                  : 'translateY(-20px)',
            transitionDelay: isCascading ? '500ms' : '0ms',
          }}
        >
          <StatusStrip govState={govState ?? undefined} />
        </div>

        {/* Layer 3: Seneca Strip — Phase 2A */}
        {/* Placeholder: will be replaced by SenecaStrip component */}

        {/* Spacer to push action rail and tabs to edges */}
        <div className="flex-1" />

        {/* Layer 4: Action Rail — Phase 2B */}
        {/* Placeholder: will be replaced by ActionRail component */}

        {/* Layer 5: Overlay Tabs — Phase 2C */}
        {/* Placeholder: will be replaced by OverlayTabs component */}
      </div>

      {/* Globe tooltip */}
      <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} />
    </div>
  );
}
