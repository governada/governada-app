'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import { useHudData } from '@/hooks/useHudData';
import { useAdaptiveDensity } from '@/hooks/useAdaptiveDensity';
import { useGlobeKeyboardNav } from '@/hooks/useGlobeKeyboardNav';
import { HudOverlay } from './hud/HudOverlay';
import { HudRings } from './hud/HudRings';
import { HudGauges } from './hud/HudGauges';
import { HudEpochArc } from './hud/HudEpochArc';
import { ActionDock } from './hud/ActionDock';
import { SenecaWhisper } from './hud/SenecaWhisper';
import RadialMenu from './hud/RadialMenu';
import CrosshairReticle from './hud/CrosshairReticle';
import { NarrativeIntro } from './hud/NarrativeIntro';
import { HudA11y } from './hud/HudA11y';
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

function shouldShowNarrative(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `governada_narrative_${today}`;
    const shown = sessionStorage.getItem(key);
    if (shown) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}

/**
 * InhabitedConstellation — The Observatory Cockpit.
 *
 * Globe fills the viewport. Transparent HUD overlays governance instruments.
 * CC members rendered as golden lattice arcs. Radial menus on entity click.
 * Narrative intro choreography on first daily visit.
 * Camera flies in to user node automatically (handled inside GlobeConstellation via flyToUserOnReady).
 */
export function InhabitedConstellation() {
  const globeRef = useRef<ConstellationRef>(null);
  const router = useRouter();
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Radial menu state
  const [radialTarget, setRadialTarget] = useState<{
    node: ConstellationNode3D;
    screenPos: { x: number; y: number };
  } | null>(null);

  // Narrative intro state
  const [showNarrative, setShowNarrative] = useState(false);
  const [narrativeComplete, setNarrativeComplete] = useState(false);
  const narrativeChecked = useRef(false);

  // HUD data + adaptive density
  const hudData = useHudData();
  const density = useAdaptiveDensity(
    hudData.urgencyLevel === 'critical' ? 80 : hudData.urgencyLevel === 'active' ? 50 : 15,
    'high',
  );

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

  // Seneca thread (Zustand store)
  const senecaOpen = useSenecaThreadStore((s) => s.isOpen);
  const senecaSetOpen = useSenecaThreadStore((s) => s.setOpen);
  const senecaStartConversation = useSenecaThreadStore((s) => s.startConversation);

  // Bridge (Seneca ↔ Globe commands)
  const { handleNodeClick, executeGlobeCommand } = useSenecaGlobeBridge(globeRef);

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

  // Briefing data for narrative intro
  const { data: briefingData } = useQuery({
    queryKey: ['citizen-briefing-narrative'],
    queryFn: async () => {
      const res = await fetch('/api/briefing/citizen');
      if (!res.ok) return null;
      const data = await res.json();
      return {
        proposalsDecided: data?.recap?.proposalsRatified ?? 0,
        drepVotesCast: data?.drepPerformance?.votesCast ?? 0,
        treasuryBalance: data?.treasury?.balanceAda
          ? `${(data.treasury.balanceAda / 1_000_000_000).toFixed(1)}B ADA`
          : undefined,
        ghiScore: undefined as number | undefined,
        ghiTrend: undefined as 'up' | 'down' | 'flat' | undefined,
        pendingCount: data?.upcoming?.activeProposals ?? 0,
        drepName: data?.drepPerformance?.name ?? undefined,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !narrativeChecked.current,
  });

  // --- Narrative intro: check on first load ---
  useEffect(() => {
    if (narrativeChecked.current) return;
    narrativeChecked.current = true;
    if (shouldShowNarrative()) {
      setShowNarrative(true);
    } else {
      setNarrativeComplete(true);
    }
  }, []);

  const handleNarrativeComplete = useCallback(() => {
    setShowNarrative(false);
    setNarrativeComplete(true);
  }, []);

  // --- Auto-open Seneca after narrative (or immediately if no narrative) ---
  useEffect(() => {
    if (!narrativeComplete) return;
    const timer = setTimeout(() => {
      if (!senecaOpen) senecaSetOpen(true);
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrativeComplete]);

  useEffect(() => {
    if (!narrativeComplete || !senecaOpen) return;
    const timer = setTimeout(() => {
      senecaStartConversation('Brief me on governance');
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrativeComplete, senecaOpen]);

  // --- Interaction handlers ---
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

  // On globe entity click: show radial menu instead of auto-opening Seneca
  const handleEntityClick = useCallback(
    (node: ConstellationNode3D) => {
      if (node.nodeType === 'user') {
        handleNodeClick(node);
        return;
      }
      setRadialTarget({
        node,
        screenPos: hoverScreenPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      });
    },
    [handleNodeClick, hoverScreenPos],
  );

  // Radial menu action handler
  const handleRadialAction = useCallback(
    (action: string, node: ConstellationNode3D) => {
      switch (action) {
        case 'profile':
          if (node.nodeType === 'drep') router.push(`/drep/${node.fullId}`);
          else if (node.nodeType === 'spo') router.push(`/pool/${node.fullId}`);
          else if (node.nodeType === 'cc') router.push(`/committee/${node.fullId}`);
          break;
        case 'ask_seneca':
          handleNodeClick(node);
          break;
        case 'delegate':
          router.push(`/drep/${node.fullId}?action=delegate`);
          break;
        case 'vote':
        case 'review':
          router.push(`/proposal/${node.fullId}`);
          break;
        case 'compare':
          router.push(`/compare?ids=${node.fullId}`);
          break;
        case 'watch':
          break;
        case 'share': {
          const url = `${window.location.origin}/drep/${node.fullId}`;
          navigator.clipboard?.writeText(url);
          break;
        }
        default:
          handleNodeClick(node);
      }
    },
    [handleNodeClick, router],
  );

  // Keyboard navigation
  const handleSenecaExpand = useCallback(() => {
    senecaSetOpen(true);
  }, [senecaSetOpen]);

  useGlobeKeyboardNav({
    enabled: !isMobile && !showNarrative,
    onEscape: useCallback(() => setRadialTarget(null), []),
  });

  if (isMobile) {
    return (
      <MobileConstellationView
        userNode={userNode}
        proposalNodes={proposalNodes}
        delegationBond={delegationBond}
        participation={hudData.rings.participation}
        deliberation={hudData.rings.deliberation}
        impact={hudData.rings.impact}
      />
    );
  }

  return (
    <div className="relative min-h-[100dvh]">
      {/* Globe canvas layer */}
      <div className="absolute inset-0 sm:-mt-14 overflow-hidden">
        <ConstellationScene
          ref={globeRef}
          className="w-full h-full"
          interactive
          breathing={!prefersReducedMotion}
          healthScore={narrativeData?.healthScore ?? 75}
          urgency={narrativeData?.urgency ?? 30}
          initialCameraPosition={[0, 3, 22]}
          onNodeSelect={handleEntityClick}
          onNodeHover={handleNodeHover}
          onNodeHoverScreen={handleNodeHoverScreen}
          userNode={userNode}
          proposalNodes={proposalNodes}
          delegationBond={delegationBond}
          flyToUserOnReady
        />
      </div>

      {/* Narrative intro (first daily visit) */}
      <AnimatePresence>
        {showNarrative && (
          <NarrativeIntro
            briefingData={briefingData ?? null}
            onComplete={handleNarrativeComplete}
          />
        )}
      </AnimatePresence>

      {/* HUD overlay layer — appears after narrative completes (or immediately if no narrative) */}
      {narrativeComplete && !hudData.isLoading && (
        <HudOverlay urgencyLevel={density.level}>
          {density.showRings && (
            <div className="fixed top-20 left-6 z-[12]">
              <HudRings
                participation={hudData.rings.participation}
                deliberation={hudData.rings.deliberation}
                impact={hudData.rings.impact}
                epochProgress={hudData.epochProgress}
                epochNumber={hudData.epochNumber}
              />
            </div>
          )}
          {density.showWhisper && <SenecaWhisper onExpand={handleSenecaExpand} />}
          {density.showGauges && (
            <div className="fixed bottom-12 left-6 z-[12]">
              <HudGauges
                treasury={hudData.gauges.treasury}
                ghi={hudData.gauges.ghi}
                activeProposals={hudData.gauges.activeProposals}
              />
            </div>
          )}
          {density.showActionDock && <ActionDock urgencyLevel={density.level} />}
          <HudEpochArc progress={hudData.epochProgress} />
        </HudOverlay>
      )}

      {/* Crosshair reticle on hover */}
      <CrosshairReticle
        node={hoveredNode}
        screenPos={hoverScreenPos}
        isLocked={radialTarget !== null}
      />

      {!hoveredNode && <GlobeTooltip node={null} screenPos={null} />}

      {/* Radial action menu on entity click */}
      <AnimatePresence>
        {radialTarget && (
          <RadialMenu
            node={radialTarget.node}
            screenPos={radialTarget.screenPos}
            onAction={handleRadialAction}
            onClose={() => setRadialTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Accessibility */}
      <HudA11y
        urgencyLevel={density.level}
        pendingActions={0}
        ghiScore={hudData.gauges.ghi?.score ?? null}
        treasuryLabel={hudData.gauges.treasury?.label ?? null}
        epochNumber={hudData.epochNumber}
      />
    </div>
  );
}
