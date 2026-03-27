'use client';

/**
 * GlobeLayout — Full-viewport globe experience with Seneca thread.
 *
 * This is the client-side core of the /g/ route namespace.
 * The globe fills the viewport. Entity focus is driven by URL params.
 * SSR content from child pages is rendered as sr-only for SEO.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useSenecaThread } from '@/hooks/useSenecaThread';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useWhisper } from '@/hooks/useWhisper';
const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false },
);

const SenecaOrb = dynamic(
  () => import('@/components/governada/SenecaOrb').then((m) => ({ default: m.SenecaOrb })),
  { ssr: false },
);

const SenecaThread = dynamic(
  () => import('@/components/governada/SenecaThread').then((m) => ({ default: m.SenecaThread })),
  { ssr: false },
);

interface GlobeLayoutProps {
  children: React.ReactNode;
}

export function GlobeLayout({ children }: GlobeLayoutProps) {
  const globeRef = useRef<ConstellationRef>(null);
  const router = useRouter();
  const pathname = usePathname();
  const seneca = useSenecaThread();
  const { handleNodeClick: bridgeNodeClick } = useSenecaGlobeBridge(globeRef);
  const { segment } = useSegment();
  const isAuthenticated = segment !== 'anonymous';
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const daysRemaining = totalDays - day;

  // Track whether we've done the initial focus fly-to
  const initialFocusDone = useRef(false);

  // When globe is ready + we have an entity route, fly to it
  const handleGlobeReady = useCallback(() => {
    if (initialFocusDone.current) return;
    initialFocusDone.current = true;

    // Derive focus from the route path (e.g., /g/drep/abc → flyTo drep_abc)
    const entityFocus = deriveEntityFocusFromPath(pathname);
    if (entityFocus) {
      globeRef.current?.flyToNode(entityFocus);
    }
  }, [pathname]);

  // Handle globe node selection — navigate to entity route
  const handleNodeSelect = useCallback(
    (node: ConstellationNode3D) => {
      // Build the /g/ route for this entity
      const route = nodeToRoute(node);
      if (route) {
        router.push(route);
      }
      // Also fire the Seneca bridge
      bridgeNodeClick(node);
    },
    [router, bridgeNodeClick],
  );

  // Whisper system for the orb
  const { currentWhisper, dismissWhisper } = useWhisper('governance', {
    activeProposals: activeProposalCount ?? undefined,
    epochProgress: epoch ? (day / totalDays) * 100 : undefined,
    daysRemaining,
    isAuthenticated,
  });

  const sigilState =
    seneca.mode === 'matching'
      ? ('searching' as const)
      : seneca.mode === 'conversation'
        ? ('speaking' as const)
        : seneca.mode === 'research'
          ? ('thinking' as const)
          : ('idle' as const);

  // Reset initial focus when path changes (entity navigation)
  useEffect(() => {
    initialFocusDone.current = false;
    const entityFocus = deriveEntityFocusFromPath(pathname);
    if (entityFocus && globeRef.current) {
      globeRef.current.flyToNode(entityFocus);
      initialFocusDone.current = true;
    }
  }, [pathname]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {/* Full-viewport globe — z-0 */}
      <div className="absolute inset-0 z-0">
        <ConstellationScene
          ref={globeRef}
          interactive
          className="w-full h-full"
          onReady={handleGlobeReady}
          onNodeSelect={handleNodeSelect}
          breathing
        />
      </div>

      {/* SSR content for SEO — hidden from visual users */}
      <div className="sr-only" aria-label="Governance entity details">
        {children}
      </div>

      {/* Globe controls overlay — z-20 (Phase 3 will add FilterBar here) */}
      <div className="absolute top-20 left-4 z-20 pointer-events-auto">
        {/* Placeholder for Phase 3 filter chips */}
      </div>

      {/* Panel overlay area — z-30 (Phase 2 will add entity panels here) */}
      {/* Phase 2: <PanelOverlay /> */}

      {/* Seneca companion — z-40 */}
      {!seneca.isOpen && (
        <div className="fixed bottom-6 right-6 z-40">
          <SenecaOrb
            onClick={seneca.toggle}
            sigilState={sigilState}
            accentColor={seneca.persona.accentColor}
            whisper={currentWhisper}
            onWhisperDismiss={dismissWhisper}
          />
        </div>
      )}
      <SenecaThread
        isOpen={seneca.isOpen}
        onClose={seneca.close}
        mode={seneca.mode}
        persona={seneca.persona}
        panelRoute={seneca.panelRoute}
        entityId={seneca.entityId}
        pendingQuery={seneca.pendingQuery}
        messages={seneca.messages}
        onStartConversation={seneca.startConversation}
        onStartResearch={seneca.startResearch}
        onStartMatch={seneca.startMatch}
        onReturnToIdle={seneca.returnToIdle}
        onAddMessage={seneca.addMessage}
        onUpdateLastAssistant={seneca.updateLastAssistant}
        onClearConversation={seneca.clearConversation}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a globe node ID from the current /g/ route path */
function deriveEntityFocusFromPath(pathname: string): string | null {
  // /g/drep/[id]
  const drepMatch = pathname.match(/^\/g\/drep\/([^/]+)/);
  if (drepMatch) return `drep_${decodeURIComponent(drepMatch[1])}`;

  // /g/proposal/[hash]/[index] — proposals use txHash as node ID prefix
  const proposalMatch = pathname.match(/^\/g\/proposal\/([a-f0-9]+)\/(\d+)/);
  if (proposalMatch) return `proposal_${proposalMatch[1]}_${proposalMatch[2]}`;

  // /g/pool/[id]
  const poolMatch = pathname.match(/^\/g\/pool\/([^/]+)/);
  if (poolMatch) return `spo_${decodeURIComponent(poolMatch[1])}`;

  // /g/cc/[id]
  const ccMatch = pathname.match(/^\/g\/cc\/([^/]+)/);
  if (ccMatch) return `cc_${decodeURIComponent(ccMatch[1])}`;

  return null;
}

/** Map a constellation node to its /g/ route */
function nodeToRoute(node: ConstellationNode3D): string | null {
  switch (node.nodeType) {
    case 'drep':
      return `/g/drep/${encodeURIComponent(node.fullId || node.id)}`;
    case 'proposal': {
      // Proposal IDs are typically "txHash_index"
      const lastUnderscore = node.fullId.lastIndexOf('_');
      if (lastUnderscore === -1) return `/g/proposal/${node.fullId}/0`;
      const txHash = node.fullId.slice(0, lastUnderscore);
      const index = node.fullId.slice(lastUnderscore + 1);
      return `/g/proposal/${txHash}/${index}`;
    }
    case 'spo':
      return `/g/pool/${encodeURIComponent(node.fullId || node.id)}`;
    case 'cc':
      return `/g/cc/${encodeURIComponent(node.fullId || node.id)}`;
    default:
      return null;
  }
}
