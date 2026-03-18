'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface StudioState {
  panelOpen: boolean;
  activePanel: 'agent' | 'intel' | 'notes' | 'vote';
  panelWidth: number;
  focusLevel: 0 | 1 | 2; // 0=normal, 1=panel hidden, 2=zen
  isFullWidth: boolean;
  panelOpenBeforeFullWidth: boolean;
}

interface StudioContextValue extends StudioState {
  togglePanel: (panel: 'agent' | 'intel' | 'notes' | 'vote') => void;
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
  const [state, setState] = useState<StudioState>({
    panelOpen: true,
    activePanel: 'agent',
    panelWidth: 380,
    focusLevel: 0,
    isFullWidth: false,
    panelOpenBeforeFullWidth: true,
  });

  const togglePanel = useCallback((panel: 'agent' | 'intel' | 'notes' | 'vote') => {
    setState((prev) => {
      if (prev.panelOpen && prev.activePanel === panel) {
        return { ...prev, panelOpen: false };
      }
      return { ...prev, panelOpen: true, activePanel: panel };
    });
  }, []);

  const closePanel = useCallback(() => {
    setState((prev) => ({ ...prev, panelOpen: false }));
  }, []);

  const setPanelWidth = useCallback((width: number) => {
    setState((prev) => ({ ...prev, panelWidth: Math.max(280, Math.min(width, 600)) }));
  }, []);

  const setFocusLevel = useCallback((level: 0 | 1 | 2) => {
    setState((prev) => ({
      ...prev,
      focusLevel: level,
      panelOpen: level === 0 ? prev.panelOpen : false,
    }));
  }, []);

  const toggleFullWidth = useCallback(() => {
    setState((prev) => {
      if (!prev.isFullWidth) {
        // Entering full-width: save current panel state, close panel
        return {
          ...prev,
          isFullWidth: true,
          panelOpenBeforeFullWidth: prev.panelOpen,
          panelOpen: false,
        };
      } else {
        // Exiting full-width: restore previous panel state
        return { ...prev, isFullWidth: false, panelOpen: prev.panelOpenBeforeFullWidth };
      }
    });
  }, []);

  return (
    <StudioContext.Provider
      value={{
        ...state,
        togglePanel,
        closePanel,
        setPanelWidth,
        setFocusLevel,
        toggleFullWidth,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}
