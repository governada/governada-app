'use client';

/**
 * useIntelligencePanel — Panel state management for the Governance Co-Pilot.
 *
 * Manages:
 * - Open/closed state (persisted in localStorage)
 * - Current route detection for panel content routing
 * - Responsive width based on viewport
 * - Toggle function (wired to `]` keyboard shortcut + rail icon)
 * - CustomEvent listener for ShortcutProvider integration
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'governada_intelligence_panel';
const PANEL_WIDTH_LARGE = 320; // >=1440px
const PANEL_WIDTH_MEDIUM = 280; // 1280-1439px
const BREAKPOINT_LARGE = 1440;
const BREAKPOINT_MEDIUM = 1280;

// ---------------------------------------------------------------------------
// Route types for panel content routing
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

/**
 * Extract entity ID from pathname for intelligence API calls.
 */
function extractEntityId(pathname: string): string | undefined {
  // /proposal/[hash]/[index]
  const proposalMatch = pathname.match(/^\/proposal\/([a-f0-9]+)\/(\d+)/);
  if (proposalMatch) return proposalMatch[1];

  // /drep/[id]
  const drepMatch = pathname.match(/^\/drep\/([^/]+)/);
  if (drepMatch) return decodeURIComponent(drepMatch[1]);

  return undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseIntelligencePanelResult {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Toggle the panel open/closed */
  toggle: () => void;
  /** Open the panel */
  open: () => void;
  /** Close the panel */
  close: () => void;
  /** Current panel route (determines content) */
  panelRoute: PanelRoute;
  /** Entity ID extracted from current route (for API calls) */
  entityId: string | undefined;
  /** Panel width in pixels (responsive to viewport) */
  panelWidth: number;
  /** Whether the viewport is wide enough for the panel */
  canShowPanel: boolean;
}

export function useIntelligencePanel(): UseIntelligencePanelResult {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setIsOpen(true);
    } catch {
      // localStorage unavailable
    }
    setViewportWidth(window.innerWidth);
  }, []);

  // Track viewport width
  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for CustomEvent from ShortcutProvider
  useEffect(() => {
    function handleToggle() {
      setIsOpen((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // localStorage unavailable
        }
        return next;
      });
    }
    window.addEventListener('toggleIntelligencePanel', handleToggle);
    return () => window.removeEventListener('toggleIntelligencePanel', handleToggle);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'false');
    } catch {
      // localStorage unavailable
    }
  }, []);

  const panelRoute = useMemo(() => detectPanelRoute(pathname), [pathname]);
  const entityId = useMemo(() => extractEntityId(pathname), [pathname]);

  const canShowPanel = viewportWidth >= BREAKPOINT_MEDIUM;
  const panelWidth =
    viewportWidth >= BREAKPOINT_LARGE
      ? PANEL_WIDTH_LARGE
      : viewportWidth >= BREAKPOINT_MEDIUM
        ? PANEL_WIDTH_MEDIUM
        : PANEL_WIDTH_LARGE; // fallback (hidden anyway)

  return {
    isOpen,
    toggle,
    open,
    close,
    panelRoute,
    entityId,
    panelWidth,
    canShowPanel,
  };
}
