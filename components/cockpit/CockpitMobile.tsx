'use client';

/**
 * CockpitMobile — Mobile layout for the Cockpit homepage.
 *
 * Top 1/3: Compact globe with touch interaction.
 * Below: scrollable vertical layout with status pills, Seneca card,
 * action feed, and overlay tabs at the bottom.
 */

import { useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion, motion, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { GlobeTooltip } from '@/components/governada/GlobeTooltip';
import { useCockpitStore } from '@/stores/cockpitStore';
import { useCockpitActions } from '@/hooks/useCockpitActions';
import { useSenecaStrip } from '@/hooks/useSenecaStrip';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import { useEpochContext } from '@/hooks/useEpochContext';
import { ActionRailCard } from './ActionRailCard';
import { OverlayTabs } from './OverlayTabs';
import type { ActionRailItem } from '@/lib/cockpit/types';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-[33vh] bg-background" /> },
);

// ---------------------------------------------------------------------------
// Status Pills
// ---------------------------------------------------------------------------

function MobileStatusPills({
  temperature,
  urgentCount,
}: {
  temperature: number;
  urgentCount: number;
}) {
  const { epoch, day, totalDays } = useEpochContext();
  const remainingDays = totalDays - day;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar">
      <span className="shrink-0 rounded-full bg-black/50 px-3 py-1 text-[11px] font-mono text-muted-foreground backdrop-blur-sm border border-white/5">
        E{epoch} D{day}/{totalDays}
        {remainingDays > 0 && ` · ${remainingDays}d left`}
      </span>
      <span
        className="shrink-0 rounded-full bg-black/50 px-3 py-1 text-[11px] font-mono backdrop-blur-sm border border-white/5"
        style={{
          color:
            temperature >= 80
              ? '#f87171'
              : temperature >= 60
                ? '#fbbf24'
                : temperature >= 40
                  ? '#facc15'
                  : '#2dd4bf',
        }}
      >
        {Math.round(temperature)}°
      </span>
      {urgentCount > 0 && (
        <span className="shrink-0 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-mono text-red-400 border border-red-500/20">
          {urgentCount} urgent
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seneca Card
// ---------------------------------------------------------------------------

function MobileSenecaCard() {
  const { currentText, mode } = useSenecaStrip();
  const startConversation = useSenecaThreadStore((s) => s.startConversation);

  return (
    <button
      onClick={() => startConversation(currentText)}
      className="mx-4 rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-left backdrop-blur-sm"
    >
      <p className="text-xs text-muted-foreground line-clamp-2">{currentText}</p>
      {mode !== 'boot' && (
        <span className="mt-1 block text-[10px] text-compass-teal/60">Ask more &#9656;</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Haptic helper
// ---------------------------------------------------------------------------

function triggerHaptic(type: 'light' | 'medium' | 'confirm' = 'light') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const patterns: Record<string, number | number[]> = {
    light: 10,
    medium: 25,
    confirm: [15, 50, 30],
  };
  try {
    navigator.vibrate(patterns[type] ?? 10);
  } catch {
    /* unsupported */
  }
}

// ---------------------------------------------------------------------------
// Swipeable action card wrapper (QG-5)
// ---------------------------------------------------------------------------

function SwipeableActionCard({
  item,
  index,
  isCompleting,
}: {
  item: ActionRailItem;
  index: number;
  isCompleting: boolean;
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 120], [1, 0.3]);
  const completeAction = useCockpitStore((s) => s.completeAction);

  return (
    <motion.div
      style={{ x, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.3}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) {
          triggerHaptic('confirm');
          completeAction(item.id);
        }
      }}
      onTapStart={() => triggerHaptic('light')}
    >
      <ActionRailCard item={item} index={index} isCompleting={isCompleting} />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Action Feed
// ---------------------------------------------------------------------------

function MobileActionFeed() {
  const { items } = useCockpitActions();
  const actionCompletions = useCockpitStore((s) => s.actionCompletions);

  if (items.length === 0) {
    return (
      <div className="mx-4 flex items-center gap-3 rounded-lg border border-green-500/20 bg-black/50 px-4 py-4 backdrop-blur-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground">No actions need attention</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4">
      {items.map((item, index) => (
        <SwipeableActionCard
          key={item.id}
          item={item}
          index={index}
          isCompleting={actionCompletions[item.id] === 'animating'}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface CockpitMobileProps {
  healthScore?: number;
  urgency?: number;
  temperature?: number;
  urgentCount?: number;
  userNode?: ConstellationNode3D | null;
  proposalNodes?: ConstellationNode3D[];
  delegationBond?: { drepNodeId: string; driftScore: number } | null;
  overlayColorMode?: 'default' | 'urgent' | 'network' | 'proposals' | 'ecosystem';
  urgentNodeIds?: Set<string>;
  completedNodeIds?: Set<string>;
  visitedNodeIds?: Set<string>;
}

export function CockpitMobile({
  healthScore = 75,
  urgency = 30,
  temperature = 50,
  urgentCount = 0,
  userNode,
  proposalNodes,
  delegationBond,
  overlayColorMode,
  urgentNodeIds,
  completedNodeIds,
  visitedNodeIds,
}: CockpitMobileProps) {
  const globeRef = useRef<ConstellationRef>(null);
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const markNodeVisited = useCockpitStore((s) => s.markNodeVisited);

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, screenPos: { x: number; y: number } | null) => {
      setHoveredNode(node);
      setHoverScreenPos(screenPos);
    },
    [],
  );

  const handleNodeSelect = useCallback(
    (node: ConstellationNode3D) => {
      markNodeVisited(node.id);
    },
    [markNodeVisited],
  );

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Compact globe — top 1/3 */}
      <div className="relative h-[33vh] w-full overflow-hidden">
        <ConstellationScene
          ref={globeRef}
          className="w-full h-full"
          interactive
          breathing={!prefersReducedMotion}
          healthScore={healthScore}
          urgency={urgency}
          initialCameraPosition={[0, 2, 18]}
          onNodeSelect={handleNodeSelect}
          onNodeHoverScreen={handleNodeHoverScreen}
          userNode={userNode}
          proposalNodes={proposalNodes}
          delegationBond={delegationBond}
          overlayColorMode={overlayColorMode}
          urgentNodeIds={urgentNodeIds}
          completedNodeIds={completedNodeIds}
          visitedNodeIds={visitedNodeIds}
        />
        <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} />
      </div>

      {/* Scrollable content — extra padding for bottom overlay tabs + safe area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Status pills */}
        <MobileStatusPills temperature={temperature} urgentCount={urgentCount} />

        {/* Seneca card */}
        <div className="py-2">
          <MobileSenecaCard />
        </div>

        {/* Action feed */}
        <div className="py-2">
          <MobileActionFeed />
        </div>
      </div>

      {/* Overlay tabs — fixed bottom */}
      <OverlayTabs />
    </div>
  );
}
