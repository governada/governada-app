'use client';

/**
 * useSenecaThread — Hook that wraps the Seneca Zustand store with route detection
 * and derived state. The canonical Seneca state hook for the unified Thread.
 *
 * Provides:
 * - Route detection (PanelRoute, entityId extraction)
 * - Auto navigateTo on route changes (WITHOUT resetting conversation)
 * - Persona detection based on current route
 * - CustomEvent listener for `]` keyboard shortcut
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import type { SenecaPersona } from '@/lib/intelligence/senecaPersonas';
import { getPersonaForRoute } from '@/lib/intelligence/senecaPersonas';
import type { ThreadMessage } from '@/stores/senecaThreadStore';

// ---------------------------------------------------------------------------
// Route types — canonical source for PanelRoute
// ---------------------------------------------------------------------------

export type PanelRoute =
  | 'hub'
  | 'proposal'
  | 'drep'
  | 'proposals-list'
  | 'representatives-list'
  | 'health'
  | 'treasury'
  | 'workspace'
  | 'default';

function detectPanelRoute(pathname: string): PanelRoute {
  if (pathname === '/' || pathname === '/hub') return 'hub';
  // Globe entity routes: /g/proposal/..., /g/drep/..., /g/pool/..., /g/cc/...
  if (/^\/g\/proposal\/[^/]+\/\d+/.test(pathname)) return 'proposal';
  if (/^\/g\/drep\/[^/]+/.test(pathname)) return 'drep';
  if (/^\/g\/pool\/[^/]+/.test(pathname)) return 'default';
  if (/^\/g\/cc\/[^/]+/.test(pathname)) return 'default';
  if (pathname === '/g') return 'hub';
  // Legacy entity routes
  if (/^\/proposal\/[^/]+\/\d+/.test(pathname)) return 'proposal';
  if (/^\/drep\/[^/]+/.test(pathname)) return 'drep';
  if (pathname === '/governance/proposals' || pathname === '/proposals') return 'proposals-list';
  if (pathname === '/governance/representatives' || pathname === '/representatives')
    return 'representatives-list';
  if (pathname === '/governance/health') return 'health';
  if (pathname === '/governance/treasury') return 'treasury';
  if (pathname.startsWith('/workspace')) return 'workspace';
  return 'default';
}

function extractEntityId(pathname: string): string | undefined {
  // Globe routes: /g/proposal/[hash]/[index], /g/drep/[id]
  const gProposalMatch = pathname.match(/^\/g\/proposal\/([a-f0-9]+)\/(\d+)/);
  if (gProposalMatch) return gProposalMatch[1];
  const gDrepMatch = pathname.match(/^\/g\/drep\/([^/]+)/);
  if (gDrepMatch) return decodeURIComponent(gDrepMatch[1]);
  const gPoolMatch = pathname.match(/^\/g\/pool\/([^/]+)/);
  if (gPoolMatch) return decodeURIComponent(gPoolMatch[1]);
  const gCcMatch = pathname.match(/^\/g\/cc\/([^/]+)/);
  if (gCcMatch) return decodeURIComponent(gCcMatch[1]);

  // Legacy routes: /proposal/[hash]/[index], /drep/[id]
  const proposalMatch = pathname.match(/^\/proposal\/([a-f0-9]+)\/(\d+)/);
  if (proposalMatch) return proposalMatch[1];
  const drepMatch = pathname.match(/^\/drep\/([^/]+)/);
  if (drepMatch) return decodeURIComponent(drepMatch[1]);

  return undefined;
}

/**
 * Human-readable page label for navigation markers in the conversation.
 */
function pageLabel(panelRoute: PanelRoute, pathname: string): string {
  switch (panelRoute) {
    case 'hub':
      return 'Home';
    case 'proposal':
      return 'Proposal Detail';
    case 'drep':
      return 'DRep Profile';
    case 'proposals-list':
      return 'Proposals';
    case 'representatives-list':
      return 'Representatives';
    case 'health':
      return 'Governance Health';
    case 'treasury':
      return 'Treasury';
    case 'workspace':
      return 'Workspace';
    default:
      // Capitalize the first segment after /
      return pathname.split('/').filter(Boolean)[0] ?? 'Page';
  }
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseSenecaThreadResult {
  // State
  isOpen: boolean;
  mode: 'idle' | 'conversation' | 'research' | 'matching';
  messages: ThreadMessage[];
  pendingQuery: string | undefined;
  panelRoute: PanelRoute;
  entityId: string | undefined;
  persona: SenecaPersona;
  visitedPages: string[];

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  startConversation: (query?: string) => void;
  startResearch: (query: string) => void;
  startMatch: () => void;
  returnToIdle: () => void;
  addMessage: (msg: ThreadMessage) => void;
  updateLastAssistant: (content: string) => void;
  clearConversation: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSenecaThread(): UseSenecaThreadResult {
  const pathname = usePathname();

  // Pull state & actions from Zustand store
  const isOpen = useSenecaThreadStore((s) => s.isOpen);
  const mode = useSenecaThreadStore((s) => s.mode);
  const messages = useSenecaThreadStore((s) => s.messages);
  const pendingQuery = useSenecaThreadStore((s) => s.pendingQuery);
  const visitedPages = useSenecaThreadStore((s) => s.visitedPages);

  const setOpen = useSenecaThreadStore((s) => s.setOpen);
  const navigateTo = useSenecaThreadStore((s) => s.navigateTo);
  const storeStartConversation = useSenecaThreadStore((s) => s.startConversation);
  const storeStartResearch = useSenecaThreadStore((s) => s.startResearch);
  const storeStartMatch = useSenecaThreadStore((s) => s.startMatch);
  const storeReturnToIdle = useSenecaThreadStore((s) => s.returnToIdle);
  const addMessage = useSenecaThreadStore((s) => s.addMessage);
  const updateLastAssistant = useSenecaThreadStore((s) => s.updateLastAssistant);
  const clearConversation = useSenecaThreadStore((s) => s.clearConversation);

  // Route derivation
  const panelRoute = useMemo(() => detectPanelRoute(pathname), [pathname]);
  const entityId = useMemo(() => extractEntityId(pathname), [pathname]);
  const persona = useMemo(() => getPersonaForRoute(panelRoute), [panelRoute]);

  // Track previous pathname to detect route changes
  const prevPathRef = useRef(pathname);

  // On route change: call navigateTo with a human-readable label (NOT reset)
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      const label = pageLabel(panelRoute, pathname);
      navigateTo(label);
    }
  }, [pathname, panelRoute, navigateTo]);

  // Listen for CustomEvent from ShortcutProvider (`]` keyboard shortcut)
  useEffect(() => {
    function handleToggle() {
      setOpen(!useSenecaThreadStore.getState().isOpen);
    }
    window.addEventListener('toggleIntelligencePanel', handleToggle);
    return () => window.removeEventListener('toggleIntelligencePanel', handleToggle);
  }, [setOpen]);

  // Stable action callbacks
  const toggle = useCallback(() => {
    setOpen(!useSenecaThreadStore.getState().isOpen);
  }, [setOpen]);

  const open = useCallback(() => setOpen(true), [setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  return {
    // State
    isOpen,
    mode,
    messages,
    pendingQuery,
    panelRoute,
    entityId,
    persona,
    visitedPages,

    // Actions
    toggle,
    open,
    close,
    startConversation: storeStartConversation,
    startResearch: storeStartResearch,
    startMatch: storeStartMatch,
    returnToIdle: storeReturnToIdle,
    addMessage,
    updateLastAssistant,
    clearConversation,
  };
}
