'use client';

/**
 * ShortcutProvider — Registers all global keyboard shortcuts.
 *
 * Wraps the shell to provide:
 * - Navigation shortcuts (G + key chords)
 * - Action shortcuts (?, /, Escape)
 * - Density mode cycling (Cmd+Shift+M)
 * - Context for page-specific shortcut registration
 * - ShortcutOverlay trigger via custom event
 *
 * Feature-flagged behind `keyboard_shortcuts`.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useFeatureFlag } from '@/components/FeatureGate';
import { useMode } from '@/components/providers/ModeProvider';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { ShortcutDefinition, ShortcutCategory } from '@/lib/shortcuts';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ShortcutContextValue {
  /** All currently registered shortcuts (global + page-specific) */
  shortcuts: ShortcutDefinition[];
  /** Register a page-specific shortcut. Returns unregister function. */
  registerShortcut: (shortcut: ShortcutDefinition) => () => void;
  /** Get shortcuts for a specific category */
  getShortcutsForCategory: (category: ShortcutCategory) => ShortcutDefinition[];
  /** Whether the shortcut system is enabled */
  enabled: boolean;
  /** Whether the help overlay is open */
  overlayOpen: boolean;
  /** Toggle the help overlay */
  toggleOverlay: () => void;
}

const ShortcutContext = createContext<ShortcutContextValue>({
  shortcuts: [],
  registerShortcut: () => () => {},
  getShortcutsForCategory: () => [],
  enabled: false,
  overlayOpen: false,
  toggleOverlay: () => {},
});

export function useShortcuts() {
  return useContext(ShortcutContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { cycleMode } = useMode();
  const keyboardFlag = useFeatureFlag('keyboard_shortcuts');
  const enabled = keyboardFlag === true;

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [pageShortcuts, setPageShortcuts] = useState<ShortcutDefinition[]>([]);

  const toggleOverlay = useCallback(() => {
    setOverlayOpen((prev) => !prev);
  }, []);

  // ── Register page-specific shortcuts ─────────────────────────────────
  const registerShortcut = useCallback((shortcut: ShortcutDefinition) => {
    setPageShortcuts((prev) => [...prev, shortcut]);
    return () => {
      setPageShortcuts((prev) => prev.filter((s) => s.id !== shortcut.id));
    };
  }, []);

  // ── Build global shortcuts ───────────────────────────────────────────
  const globalShortcuts: ShortcutDefinition[] = useMemo(
    () => [
      // Navigation chords (G + key)
      {
        id: 'nav-home',
        keys: 'G H',
        label: 'Go Home',
        description: 'Navigate to the home dashboard',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/'),
      },
      {
        id: 'nav-proposals',
        keys: 'G P',
        label: 'Go Proposals',
        description: 'Navigate to governance proposals',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/governance/proposals'),
      },
      {
        id: 'nav-representatives',
        keys: 'G R',
        label: 'Go Representatives',
        description: 'Navigate to DReps and SPOs',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/governance/representatives'),
      },
      {
        id: 'nav-treasury',
        keys: 'G T',
        label: 'Go Treasury',
        description: 'Navigate to treasury overview',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/governance/treasury'),
      },
      {
        id: 'nav-committee',
        keys: 'G C',
        label: 'Go Committee',
        description: 'Navigate to Constitutional Committee',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/governance/committee'),
      },
      {
        id: 'nav-health',
        keys: 'G E',
        label: 'Go Health',
        description: 'Navigate to Governance Health (GHI)',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/governance/health'),
      },
      {
        id: 'nav-you',
        keys: 'G Y',
        label: 'Go You',
        description: 'Navigate to your civic identity',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/you'),
      },
      {
        id: 'nav-match',
        keys: 'G M',
        label: 'Go Match',
        description: 'Navigate to representative matching',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/match'),
      },
      {
        id: 'nav-workspace',
        keys: 'G W',
        label: 'Go Workspace',
        description: 'Navigate to voting workspace',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/workspace'),
      },
      {
        id: 'nav-settings',
        keys: 'G S',
        label: 'Go Settings',
        description: 'Navigate to settings',
        category: 'navigation' as const,
        isChord: true,
        action: () => router.push('/you/settings'),
      },

      // Action shortcuts
      {
        id: 'action-help',
        keys: '?',
        label: 'Shortcuts Help',
        description: 'Show keyboard shortcut help overlay',
        category: 'actions' as const,
        action: () => setOverlayOpen((prev) => !prev),
      },
      {
        id: 'action-search',
        keys: '/',
        label: 'Focus Search',
        description: 'Focus search input on list pages',
        category: 'actions' as const,
        action: () => {
          // Find and focus search input on the current page
          const searchInput = document.querySelector<HTMLInputElement>(
            '[data-shortcut-search], input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="Filter"]',
          );
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        },
      },
      {
        id: 'action-escape',
        keys: 'Escape',
        label: 'Close',
        description: 'Close drawer, panel, or overlay',
        category: 'actions' as const,
        action: () => {
          // Close the shortcut overlay if open
          setOverlayOpen(false);
        },
      },

      // Panel shortcuts
      {
        id: 'panel-intelligence',
        keys: ']',
        label: 'Intelligence Panel',
        description: 'Toggle intelligence panel (coming soon)',
        category: 'panels' as const,
        action: () => {
          // Placeholder for Phase 5 intelligence panel
          window.dispatchEvent(new CustomEvent('toggleIntelligencePanel'));
        },
      },

      // Mode shortcuts
      {
        id: 'mode-cycle',
        keys: 'Cmd+Shift+M',
        label: 'Cycle Density',
        description: 'Cycle density mode: Browse \u2192 Work \u2192 Analyze',
        category: 'modes' as const,
        action: () => cycleMode(),
      },
    ],
    [router, cycleMode],
  );

  // ── Combined shortcuts ───────────────────────────────────────────────
  const allShortcuts = useMemo(
    () => [...globalShortcuts, ...pageShortcuts],
    [globalShortcuts, pageShortcuts],
  );

  // ── Activate keyboard handler ────────────────────────────────────────
  useKeyboardShortcuts(allShortcuts, { enabled, pathname });

  // ── Category filter ──────────────────────────────────────────────────
  const getShortcutsForCategory = useCallback(
    (category: ShortcutCategory) => allShortcuts.filter((s) => s.category === category),
    [allShortcuts],
  );

  const value = useMemo(
    () => ({
      shortcuts: allShortcuts,
      registerShortcut,
      getShortcutsForCategory,
      enabled,
      overlayOpen,
      toggleOverlay,
    }),
    [allShortcuts, registerShortcut, getShortcutsForCategory, enabled, overlayOpen, toggleOverlay],
  );

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>;
}
