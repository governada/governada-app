'use client';

/**
 * StudioProvider — backwards-compatible adapter over the Zustand workspace store.
 *
 * Provides the same `StudioContextValue` interface via React Context so existing
 * consumers using `useStudio()` / `useStudioSafe()` keep working without changes.
 *
 * TODO: Remove this adapter once all consumers migrate to useWorkspace()
 */

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { PanelId } from '@/lib/workspace/store';

interface StudioState {
  panelOpen: boolean;
  activePanel: PanelId;
  panelWidth: number;
  focusLevel: 0 | 1 | 2;
  isFullWidth: boolean;
  panelOpenBeforeFullWidth: boolean;
}

interface StudioContextValue extends StudioState {
  togglePanel: (panel: PanelId) => void;
  closePanel: () => void;
  setPanelWidth: (width: number) => void;
  setFocusLevel: (level: 0 | 1 | 2) => void;
  toggleFullWidth: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}

/** Safe version that returns null outside studio mode — no throw. */
export function useStudioSafe() {
  return useContext(StudioContext);
}

export function StudioProvider({ children }: { children: ReactNode }) {
  // Read from Zustand store
  const contextPanel = useWorkspaceStore((s) => s.contextPanel);
  const focusLevel = useWorkspaceStore((s) => s.focusLevel);
  const storeTogglePanel = useWorkspaceStore((s) => s.togglePanel);
  const storeClosePanel = useWorkspaceStore((s) => s.closePanel);
  const storeSetFocusLevel = useWorkspaceStore((s) => s.setFocusLevel);

  // Map Zustand state to the legacy StudioState shape
  const panelOpen = contextPanel !== null;
  const activePanel: PanelId = contextPanel ?? 'agent';

  // panelWidth is no longer stored in Zustand (react-resizable-panels handles its own persistence).
  // Keep a static default for the legacy interface.
  const panelWidth = 380;

  // isFullWidth maps to focusLevel >= 1 in the new model
  const isFullWidth = focusLevel >= 1;

  // Legacy toggle: same panel toggles off; different panel switches to it
  const togglePanel = useCallback(
    (panel: PanelId) => {
      storeTogglePanel(panel);
    },
    [storeTogglePanel],
  );

  const closePanel = useCallback(() => {
    storeClosePanel();
  }, [storeClosePanel]);

  // setPanelWidth is a no-op — react-resizable-panels handles sizing now
  const setPanelWidth = useCallback((_width: number) => {
    // No-op: panel width managed by react-resizable-panels
  }, []);

  const setFocusLevel = useCallback(
    (level: 0 | 1 | 2) => {
      storeSetFocusLevel(level);
    },
    [storeSetFocusLevel],
  );

  const toggleFullWidth = useCallback(() => {
    if (isFullWidth) {
      storeSetFocusLevel(0);
    } else {
      storeSetFocusLevel(1);
    }
  }, [isFullWidth, storeSetFocusLevel]);

  const value: StudioContextValue = {
    panelOpen,
    activePanel,
    panelWidth,
    focusLevel,
    isFullWidth,
    panelOpenBeforeFullWidth: true, // Legacy field, no longer meaningful
    togglePanel,
    closePanel,
    setPanelWidth,
    setFocusLevel,
    toggleFullWidth,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
