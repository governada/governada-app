'use client';

/**
 * SynapticHomePage — The Synaptic Brief authenticated homepage.
 *
 * Full-viewport volumetric constellation with a Seneca briefing panel.
 * Globe is non-interactive (Seneca controls camera). The briefing panel
 * auto-streams a personalized governance narrative on arrival, with
 * entity mentions triggering globe reactions (node pulses, camera drift).
 *
 * Globe-as-Seneca state machine: the globe's visual state reflects
 * Seneca's activity — breathing when idle, heightened urgency when
 * narrating, calm when complete.
 */

import { useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import { useSenecaGlobeBridge, type GlobeCommand } from '@/hooks/useSenecaGlobeBridge';
import { useSynapticStore } from '@/stores/synapticStore';
import { fetchTemporalData, type TemporalEpochData } from '@/lib/constellation/fetchTemporalData';
import type { GlobeStreamCommand } from '@/lib/intelligence/streamAdvisor';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { SynapticBriefPanel } from './SynapticBriefPanel';
import { TemporalScrubber } from './TemporalScrubber';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false },
);

const GlobeTooltip = dynamic(
  () => import('@/components/governada/GlobeTooltip').then((m) => ({ default: m.GlobeTooltip })),
  { ssr: false },
);

export function SynapticHomePage() {
  const globeRef = useRef<ConstellationRef>(null);
  const bridge = useSenecaGlobeBridge(globeRef);

  // Globe data
  const { userNode, delegationBond } = useUserConstellationNode();
  const { proposalNodes } = useConstellationProposals();

  // Seneca state — drives globe visual state
  const isStreaming = useSynapticStore((s) => s.isStreaming);
  const phase = useSynapticStore((s) => s.phase);

  // Globe visual state derived from Seneca activity:
  // - idle/minimized: gentle breathing, low urgency
  // - briefing/conversation streaming: heightened urgency = faster heartbeat
  // - briefing done: calm, low urgency
  const globeUrgency = isStreaming ? 65 : phase === 'briefing' ? 35 : 20;

  // Tooltip state
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);

  // Temporal replay state
  const [temporalData, setTemporalData] = useState<TemporalEpochData | null>(null);

  // -------------------------------------------------------------------------
  // Globe command handler — bridge stream commands to globe imperative API
  // -------------------------------------------------------------------------
  const handleGlobeCommand = useCallback(
    (command: GlobeStreamCommand) => {
      if (!command.cmd) return;

      const bridgeCmd: GlobeCommand =
        command.cmd === 'flyTo' && command.target
          ? { type: 'flyTo', nodeId: command.target }
          : command.cmd === 'pulse' && command.target
            ? { type: 'pulse', nodeId: command.target }
            : command.cmd === 'highlight' && command.alignment
              ? {
                  type: 'highlight',
                  alignment: command.alignment,
                  threshold: command.threshold ?? 120,
                }
              : command.cmd === 'voteSplit' && command.target
                ? { type: 'voteSplit', proposalRef: command.target }
                : command.cmd === 'reset'
                  ? { type: 'reset' }
                  : { type: 'clear' };

      // Handle temporal replay command — fetch epoch data and activate scrubber
      if (command.cmd === 'temporal' && command.target) {
        const epochMatch = command.target.match(/epoch_(\d+)/);
        if (epochMatch) {
          const epochNum = parseInt(epochMatch[1], 10);
          void fetchTemporalData(epochNum).then((data) => {
            if (data) setTemporalData(data);
          });
        }
        return;
      }

      bridge.executeGlobeCommand(bridgeCmd);
    },
    [bridge],
  );

  // -------------------------------------------------------------------------
  // Temporal replay handlers
  // -------------------------------------------------------------------------
  const handleTemporalProgress = useCallback(
    (progress: number, voteMap: Map<string, 'Yes' | 'No' | 'Abstain'>) => {
      globeRef.current?.setTemporalState(progress, voteMap);
    },
    [],
  );

  const handleTemporalClose = useCallback(() => {
    setTemporalData(null);
    globeRef.current?.clearTemporal();
  }, []);

  // -------------------------------------------------------------------------
  // Hover handlers (globe tooltips)
  // -------------------------------------------------------------------------
  const handleNodeHover = useCallback((node: ConstellationNode3D | null) => {
    setHoveredNode(node);
  }, []);

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, pos: { x: number; y: number } | null) => {
      setHoveredNode(node);
      setHoverScreenPos(pos);
    },
    [],
  );

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden" style={{ background: '#0a0b14' }}>
      {/* Full-viewport globe — non-interactive, Seneca-controlled */}
      <ConstellationScene
        ref={globeRef}
        interactive={false}
        breathing
        urgency={globeUrgency}
        className="h-full"
        userNode={userNode}
        proposalNodes={proposalNodes}
        delegationBond={delegationBond}
        onNodeHover={handleNodeHover}
        onNodeHoverScreen={handleNodeHoverScreen}
      />

      {/* Cursor-following tooltip */}
      <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} />

      {/* Temporal scrubber — shown when epoch replay is active */}
      {temporalData && (
        <TemporalScrubber
          epoch={temporalData.epoch}
          epochStart={temporalData.epochStart}
          epochEnd={temporalData.epochEnd}
          events={temporalData.events}
          onProgressChange={handleTemporalProgress}
          onClose={handleTemporalClose}
        />
      )}

      {/* Seneca briefing panel — bottom-left, responsive */}
      <SynapticBriefPanel onGlobeCommand={handleGlobeCommand} />
    </div>
  );
}
