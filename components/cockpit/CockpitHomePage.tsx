'use client';

/**
 * CockpitHomePage — The Cockpit command center homepage.
 *
 * Replaces InhabitedConstellation when globe_homepage_v2 is enabled.
 * Full-viewport globe with HUD layers: StatusStrip, SenecaStrip,
 * ActionRail, OverlayTabs — all reactive via cockpitStore.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useGovernadaSound } from '@/hooks/useGovernadaSound';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import { useCockpitStore } from '@/stores/cockpitStore';
import { useCockpitActions } from '@/hooks/useCockpitActions';
import { StatusStrip } from './StatusStrip';
import { SenecaStrip } from './SenecaStrip';
import { ActionRail } from './ActionRail';
import { OverlayTabs } from './OverlayTabs';
import { CockpitDetailPanel } from './CockpitDetailPanel';
import { CockpitMobile } from './CockpitMobile';
import { CockpitTextMode } from './CockpitTextMode';
import { NetworkEdges } from './NetworkEdges';
import { computeDensityLevel, BOOT_SEQUENCE, BOOT_TOTAL_MS } from '@/lib/cockpit/types';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

// Boot timing derived from BOOT_SEQUENCE constants
const BOOT_DELAYS = Object.fromEntries(BOOT_SEQUENCE.map((s) => [s.component, s.delay])) as Record<
  string,
  number
>;

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-background" /> },
);

const BOOT_SESSION_KEY = 'cockpit_booted';

export function CockpitHomePage() {
  const globeRef = useRef<ConstellationRef>(null);
  const [hoveredNode, setLocalHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNode3D | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const flyInAttempted = useRef(false);

  // Cockpit store
  const bootPhase = useCockpitStore((s) => s.bootPhase);
  const activeOverlay = useCockpitStore((s) => s.activeOverlay);
  const setBootPhase = useCockpitStore((s) => s.setBootPhase);
  const setDensityLevel = useCockpitStore((s) => s.setDensityLevel);
  const setStoreHoveredNode = useCockpitStore((s) => s.setHoveredNode);
  const setStoreHoveredNodeData = useCockpitStore((s) => s.setHoveredNodeData);
  const markNodeVisited = useCockpitStore((s) => s.markNodeVisited);
  const visitedNodeIds = useCockpitStore((s) => s.visitedNodeIds);

  // Memoize visited set to avoid unnecessary re-renders in the globe
  const visitedNodeIdSet = useMemo(
    () => (visitedNodeIds.length > 0 ? new Set(visitedNodeIds) : undefined),
    [visitedNodeIds],
  );

  // Action queue — allItems for completion mapping, items for display
  const actionCompletions = useCockpitStore((s) => s.actionCompletions);
  const { allItems, urgentCount: realUrgentCount } = useCockpitActions();
  const [completedGlobeNodeIds, setCompletedGlobeNodeIds] = useState<Set<string>>(new Set());

  // SV-1: Compute urgentNodeIds from action items for globe coloring
  const urgentNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of allItems) {
      if (item.globeNodeId && (item.priority === 'urgent' || item.priority === 'high')) {
        ids.add(item.globeNodeId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [allItems]);

  // SV-5: Map completed actions to globe node IDs using allItems (not filtered items)
  // QG-7: Track whether we have completions separately to avoid stale Set reference in deps
  const hasCompletedNodes = completedGlobeNodeIds.size > 0;
  useEffect(() => {
    const animatingIds = Object.entries(actionCompletions)
      .filter(([, status]) => status === 'animating')
      .map(([id]) => id);
    if (animatingIds.length === 0) {
      if (hasCompletedNodes) {
        const timer = setTimeout(() => setCompletedGlobeNodeIds(new Set()), 2000);
        return () => clearTimeout(timer);
      }
      return;
    }
    const nodeIds = new Set<string>();
    for (const id of animatingIds) {
      const item = allItems.find((i) => i.id === id);
      if (item?.globeNodeId) nodeIds.add(item.globeNodeId);
    }
    if (nodeIds.size > 0) setCompletedGlobeNodeIds(nodeIds);
  }, [actionCompletions, allItems, hasCompletedNodes]);

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
  const { executeGlobeCommand } = useSenecaGlobeBridge(globeRef);
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

  // SV-9: Use real urgentCount from action queue (not approximated from urgencyScore)
  useEffect(() => {
    if (!govState) return;
    setDensityLevel(computeDensityLevel(realUrgentCount, govState.temperatureScore));
  }, [govState, realUrgentCount, setDensityLevel]);

  // Sound — start ambient on boot completion, modulate by temperature
  const { startAmbient, updateAmbientTemperature, playPing } = useGovernadaSound();

  // Sound: ping when urgent count increases (new urgent action arrived)
  const prevUrgentCountRef = useRef(realUrgentCount);
  useEffect(() => {
    if (realUrgentCount > prevUrgentCountRef.current && bootPhase === 'ready') {
      playPing();
    }
    prevUrgentCountRef.current = realUrgentCount;
  }, [realUrgentCount, bootPhase, playPing]);
  useEffect(() => {
    if (bootPhase === 'ready') {
      startAmbient(govState?.temperatureScore);
    }
  }, [bootPhase, startAmbient, govState?.temperatureScore]);

  useEffect(() => {
    if (govState?.temperatureScore != null) {
      updateAmbientTemperature(govState.temperatureScore);
    }
  }, [govState?.temperatureScore, updateAmbientTemperature]);

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

    // Start cascade — total duration from BOOT_SEQUENCE constants
    setBootPhase('cascade');
    const readyTimer = setTimeout(() => {
      setBootPhase('ready');
      try {
        sessionStorage.setItem(BOOT_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
    }, BOOT_TOTAL_MS);

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
      setStoreHoveredNodeData(
        node
          ? {
              name: node.name,
              nodeType: node.nodeType,
              score: node.score,
              delegatorCount: node.delegatorCount,
              adaAmount: node.adaAmount,
              drepStatus: node.drepStatus,
              voteCount: node.voteCount,
              fidelityGrade: node.fidelityGrade,
              dominant: node.dominant,
            }
          : null,
      );
    },
    [setStoreHoveredNode, setStoreHoveredNodeData],
  );

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, screenPos: { x: number; y: number } | null) => {
      setLocalHoveredNode(node);
      setStoreHoveredNode(node?.id ?? null);
      setStoreHoveredNodeData(
        node
          ? {
              name: node.name,
              nodeType: node.nodeType,
              score: node.score,
              delegatorCount: node.delegatorCount,
              adaAmount: node.adaAmount,
              drepStatus: node.drepStatus,
              voteCount: node.voteCount,
              fidelityGrade: node.fidelityGrade,
              dominant: node.dominant,
            }
          : null,
      );
      setHoverScreenPos(screenPos);
    },
    [setStoreHoveredNode, setStoreHoveredNodeData],
  );

  const handleNodeSelect = useCallback(
    (node: ConstellationNode3D) => {
      markNodeVisited(node.id);
      // Open the detail panel instead of Seneca bridge click
      setSelectedNode(node);
      // Clear hover tooltip while panel is open
      setLocalHoveredNode(null);
      setHoverScreenPos(null);
    },
    [markNodeVisited],
  );

  // Close detail panel → reset globe camera + clear hovered state
  const handleDetailPanelClose = useCallback(() => {
    setSelectedNode(null);
    setStoreHoveredNode(null);
    globeRef.current?.resetCamera();
  }, [setStoreHoveredNode]);

  // Mobile layout — compact globe + scrollable feed
  if (isMobile) {
    const temperature = govState?.temperatureScore ?? 50;
    return (
      <CockpitMobile
        healthScore={narrativeData?.healthScore ?? 75}
        urgency={narrativeData?.urgency ?? 30}
        temperature={temperature}
        urgentCount={realUrgentCount}
        userNode={userNode}
        proposalNodes={proposalNodes}
        delegationBond={delegationBond}
        overlayColorMode={activeOverlay}
        urgentNodeIds={urgentNodeIds}
        completedNodeIds={completedGlobeNodeIds.size > 0 ? completedGlobeNodeIds : undefined}
        visitedNodeIds={visitedNodeIdSet}
      />
    );
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
          overlayColorMode={activeOverlay}
          urgentNodeIds={urgentNodeIds}
          completedNodeIds={completedGlobeNodeIds.size > 0 ? completedGlobeNodeIds : undefined}
          visitedNodeIds={visitedNodeIdSet}
        />
      </div>

      {/* HUD overlay container — pointer-events-none by default, children opt in */}
      {/* SV-1 fix: pt-10 pushes HUD below the sticky GovernadaHeader (h-10, z-50) */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col pt-10">
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
            transitionDelay: isCascading ? `${BOOT_DELAYS['status-strip']}ms` : '0ms',
          }}
        >
          <StatusStrip govState={govState ?? undefined} realUrgentCount={realUrgentCount} />
        </div>

        {/* Layer 3: Seneca Strip */}
        <div className="pointer-events-auto">
          <SenecaStrip />
        </div>

        {/* Spacer to push action rail and tabs to edges */}
        <div className="flex-1 relative">
          {/* Layer 4: Action Rail — positioned absolutely within the spacer */}
          <div
            className="pointer-events-auto absolute left-4 top-4 transition-all duration-500"
            style={{
              opacity: isReady || isCascading ? 1 : 0,
              transform:
                isCascading && !isReady
                  ? 'translateX(-20px)'
                  : isReady
                    ? 'translateX(0)'
                    : 'translateX(-20px)',
              transitionDelay: isCascading ? `${BOOT_DELAYS['action-rail']}ms` : '0ms',
            }}
          >
            <ActionRail />
          </div>
        </div>

        {/* Layer 5: Overlay Tabs */}
        <OverlayTabs />
      </div>

      {/* Network edges legend — only shows in network overlay */}
      <NetworkEdges />

      {/* Globe tooltip — hide when detail panel is open */}
      {!selectedNode && <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} />}

      {/* Detail panel — slides in from right on node selection */}
      <CockpitDetailPanel node={selectedNode} onClose={handleDetailPanelClose} />

      {/* Screen reader accessible text representation */}
      <CockpitTextMode />
    </div>
  );
}
