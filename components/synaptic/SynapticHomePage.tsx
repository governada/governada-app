'use client';

/**
 * SynapticHomePage — The Synaptic Brief authenticated homepage.
 *
 * Full-viewport volumetric constellation with a Seneca briefing panel.
 * Globe is interactive — users can click nodes while Seneca is active.
 * The briefing panel auto-streams a personalized governance narrative
 * on arrival, with entity mentions triggering globe reactions.
 *
 * URL params drive discovery/entity/match state:
 * - ?filter=proposals → DiscoveryOverlay + globe highlight
 * - ?entity=drep_[id] → EntityDetailSheet + globe flyTo
 * - ?match=true → trigger match flow via Seneca
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import { useSenecaGlobeBridge, type GlobeCommand } from '@/hooks/useSenecaGlobeBridge';
import { useSynapticStore } from '@/stores/synapticStore';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import { fetchTemporalData, type TemporalEpochData } from '@/lib/constellation/fetchTemporalData';
import { posthog } from '@/lib/posthog';
import { parseEntityParam, encodeEntityParam } from '@/lib/homepage/parseEntityParam';
import type { EntityRef } from '@/lib/homepage/parseEntityParam';
import type { GlobeStreamCommand } from '@/lib/intelligence/streamAdvisor';
import type { ConstellationRef } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { useGlobeCommandListener } from '@/hooks/useGlobeCommandListener';
import { SynapticBriefPanel } from './SynapticBriefPanel';
import { TemporalScrubber } from './TemporalScrubber';
import { EntityDetailSheet } from '@/components/hub/EntityDetailSheet';
import { DiscoveryOverlay } from '@/components/hub/DiscoveryOverlay';
import { SinceLastVisit } from '@/components/SinceLastVisit';
import { useSegment } from '@/components/providers/SegmentProvider';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false },
);

const GlobeTooltip = dynamic(
  () => import('@/components/governada/GlobeTooltip').then((m) => ({ default: m.GlobeTooltip })),
  { ssr: false },
);

interface SynapticHomePageProps {
  filter?: string;
  entity?: string;
  match?: boolean;
  sort?: string;
}

export function SynapticHomePage({
  filter: initialFilter,
  entity: initialEntity,
  match: initialMatch,
  sort: initialSort,
}: SynapticHomePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const globeRef = useRef<ConstellationRef>(null);
  const bridge = useSenecaGlobeBridge(globeRef);

  // User context for SinceLastVisit
  const { segment, drepId: delegatedDrepId } = useSegment();
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || segment === 'anonymous') return;
    const ts = localStorage.getItem('drepscore_last_visit');
    if (ts) setPreviousVisitAt(new Date(Number(ts)).toISOString());
  }, [segment]);

  // Globe data
  const { userNode, delegationBond } = useUserConstellationNode();
  const { proposalNodes } = useConstellationProposals();

  // Seneca state — drives globe visual state
  const isStreaming = useSynapticStore((s) => s.isStreaming);
  const phase = useSynapticStore((s) => s.phase);

  // ── URL param state ──────────────────────────────────────
  // Use local state initialized from server params, updated via URL
  const [activeFilter, setActiveFilter] = useState<string | null>(initialFilter ?? null);
  const [activeEntity, setActiveEntity] = useState<EntityRef | null>(
    parseEntityParam(initialEntity),
  );

  // Guard: skip URL sync when the change was initiated by our own updateUrl
  const isInternalUpdate = useRef(false);

  // Sync URL params to local state when they change via browser navigation
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const urlFilter = searchParams.get('filter');
    const urlEntity = searchParams.get('entity');
    setActiveFilter(urlFilter);
    setActiveEntity(parseEntityParam(urlEntity));
  }, [searchParams]);

  // Trigger match flow from URL param on mount (once only)
  const matchTriggered = useRef(false);
  useEffect(() => {
    if (initialMatch && !matchTriggered.current) {
      matchTriggered.current = true;
      useSenecaThreadStore.getState().startMatch();
    }
  }, [initialMatch]);

  // Update URL when filter/entity change via UI interaction
  const updateUrl = useCallback(
    (params: Record<string, string | null>) => {
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, value);
        }
      }
      isInternalUpdate.current = true;
      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
  );

  const handleFilterChange = useCallback(
    (filter: string | null) => {
      setActiveFilter(filter);
      setActiveEntity(null); // Close entity detail when changing filter
      updateUrl({ filter, entity: null });
    },
    [updateUrl],
  );

  const handleEntitySelect = useCallback(
    (entityParam: string) => {
      const parsed = parseEntityParam(entityParam);
      setActiveEntity(parsed);
      updateUrl({ entity: entityParam });
      if (parsed) {
        posthog.capture('entity_selected', {
          type: parsed.type,
          id: parsed.id,
          source: 'homepage',
        });
      }

      // Fly globe to entity node
      if (parsed) {
        const nodeId =
          parsed.type === 'proposal' ? `${parsed.id}_${parsed.secondaryId}` : parsed.id;
        bridge.executeGlobeCommand({ type: 'flyTo', nodeId });
      }
    },
    [updateUrl, bridge],
  );

  const handleEntityClose = useCallback(() => {
    setActiveEntity(null);
    updateUrl({ entity: null });
  }, [updateUrl]);

  const handleFilterClose = useCallback(() => {
    setActiveFilter(null);
    updateUrl({ filter: null });
    bridge.executeGlobeCommand({ type: 'clear' });
  }, [updateUrl, bridge]);

  // ── Globe event bridge ──────────────────────────────────

  // Listen for globe commands from Seneca (via centralized command bus)
  useGlobeCommandListener(bridge);

  // Globe visual state derived from Seneca activity
  const globeUrgency = isStreaming ? 65 : phase === 'briefing' ? 35 : 20;

  // Tooltip state
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);

  // Temporal replay state
  const [temporalData, setTemporalData] = useState<TemporalEpochData | null>(null);

  // ── Globe command handler ───────────────────────────────
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

      // Handle temporal replay command
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

  // ── Node click handler ──────────────────────────────────
  const handleNodeClick = useCallback(
    (node: ConstellationNode3D) => {
      // Fly to node on globe
      bridge.executeGlobeCommand({ type: 'flyTo', nodeId: node.id });

      // Determine entity type from node and open detail sheet
      const nodeType = node.nodeType ?? 'drep';
      let entityParam: string;

      if (nodeType === 'proposal') {
        // Proposal node IDs are "txHash_index"
        const lastUnderscore = node.id.lastIndexOf('_');
        if (lastUnderscore > 0) {
          const txHash = node.id.slice(0, lastUnderscore);
          const idx = node.id.slice(lastUnderscore + 1);
          entityParam = encodeEntityParam('proposal', txHash, idx);
        } else {
          entityParam = encodeEntityParam('proposal', node.id, '0');
        }
      } else if (nodeType === 'cc') {
        entityParam = encodeEntityParam('cc', node.id);
      } else if (nodeType === 'spo') {
        entityParam = encodeEntityParam('pool', node.id);
      } else {
        entityParam = encodeEntityParam('drep', node.id);
      }

      handleEntitySelect(entityParam);
    },
    [bridge, handleEntitySelect],
  );

  // ── Temporal handlers ───────────────────────────────────
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

  // ── Hover handlers ──────────────────────────────────────
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
      {/* Full-viewport globe — interactive for auth users */}
      <ConstellationScene
        ref={globeRef}
        interactive
        breathing
        urgency={globeUrgency}
        className="h-full"
        userNode={userNode}
        proposalNodes={proposalNodes}
        delegationBond={delegationBond}
        onNodeSelect={handleNodeClick}
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

      {/* Discovery overlay — shows entity list when filter is active */}
      <DiscoveryOverlay
        filter={activeFilter}
        initialSort={initialSort}
        onEntitySelect={handleEntitySelect}
        onClose={handleFilterClose}
      />

      {/* Entity detail sheet — shows when an entity is selected */}
      <EntityDetailSheet entity={activeEntity} onClose={handleEntityClose} />

      {/* Since last visit — compact activity summary for returning users */}
      {previousVisitAt && segment !== 'anonymous' && (
        <div className="fixed bottom-[calc(theme(spacing.6)+14rem)] left-6 z-40 w-[min(440px,calc(100vw-3rem))] max-md:bottom-[calc(14rem)] max-md:left-4 max-md:right-4 max-md:w-auto">
          <SinceLastVisit previousVisitAt={previousVisitAt} delegatedDrepId={delegatedDrepId} />
        </div>
      )}

      {/* Seneca briefing panel — bottom-left, responsive */}
      <SynapticBriefPanel onGlobeCommand={handleGlobeCommand} onFilterChange={handleFilterChange} />
    </div>
  );
}
