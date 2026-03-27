'use client';

/**
 * cockpitStore — Zustand store for the Cockpit homepage HUD state.
 *
 * Manages:
 * - Active overlay tab (urgent/network/proposals/ecosystem)
 * - Boot sequence phase
 * - Visited node memory (sessionStorage)
 * - Sound toggle (localStorage)
 * - Action completion tracking
 * - Seneca mode (alert vs discovery)
 * - Contextual density level
 * - Temporal scrub epoch
 * - Hovered node ID (for cross-component reactivity)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CockpitOverlay, BootPhase, DensityLevel } from '@/lib/cockpit/types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface CockpitState {
  /** Active overlay tab */
  activeOverlay: CockpitOverlay;
  /** Boot sequence phase */
  bootPhase: BootPhase;
  /** Node IDs the user has interacted with this session */
  visitedNodeIds: string[];
  /** Whether sound effects are enabled */
  soundEnabled: boolean;
  /** Action items currently animating completion */
  actionCompletions: Record<string, 'animating' | 'done'>;
  /** Seneca strip mode */
  senecaMode: 'alert' | 'discovery';
  /** Contextual density level driven by governance activity */
  densityLevel: DensityLevel;
  /** Epoch for temporal scrubbing (null = live) */
  temporalEpoch: number | null;
  /** Currently hovered node ID (for cross-component reactivity) */
  hoveredNodeId: string | null;
}

export interface CockpitActions {
  setOverlay: (overlay: CockpitOverlay) => void;
  setBootPhase: (phase: BootPhase) => void;
  markNodeVisited: (nodeId: string) => void;
  toggleSound: () => void;
  completeAction: (actionId: string) => void;
  clearActionCompletion: (actionId: string) => void;
  setSenecaMode: (mode: 'alert' | 'discovery') => void;
  setDensityLevel: (level: DensityLevel) => void;
  setTemporalEpoch: (epoch: number | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Store — sound persists to localStorage, visited nodes to sessionStorage
// ---------------------------------------------------------------------------

/**
 * The store splits persistence:
 * - `soundEnabled` uses localStorage (survives sessions)
 * - `visitedNodeIds` uses sessionStorage (cleared on tab close)
 * - Everything else is ephemeral (reset on page reload)
 */
export const useCockpitStore = create<CockpitState & CockpitActions>()(
  persist(
    (set) => ({
      // -----------------------------------------------------------------------
      // Initial state
      // -----------------------------------------------------------------------
      activeOverlay: 'urgent',
      bootPhase: 'pending',
      visitedNodeIds: [],
      soundEnabled: false,
      actionCompletions: {},
      senecaMode: 'alert',
      densityLevel: 'normal',
      temporalEpoch: null,
      hoveredNodeId: null,

      // -----------------------------------------------------------------------
      // Actions
      // -----------------------------------------------------------------------
      setOverlay: (overlay) => set({ activeOverlay: overlay }),

      setBootPhase: (phase) => set({ bootPhase: phase }),

      markNodeVisited: (nodeId) =>
        set((state) => {
          if (state.visitedNodeIds.includes(nodeId)) return state;
          // Cap at 200 to prevent unbounded growth
          const next = [...state.visitedNodeIds, nodeId].slice(-200);
          return { visitedNodeIds: next };
        }),

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      completeAction: (actionId) =>
        set((state) => ({
          actionCompletions: { ...state.actionCompletions, [actionId]: 'animating' },
        })),

      clearActionCompletion: (actionId) =>
        set((state) => {
          const next = { ...state.actionCompletions };
          delete next[actionId];
          return { actionCompletions: next };
        }),

      setSenecaMode: (mode) => set({ senecaMode: mode }),

      setDensityLevel: (level) => set({ densityLevel: level }),

      setTemporalEpoch: (epoch) => set({ temporalEpoch: epoch }),

      setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
    }),
    {
      name: 'governada_cockpit',
      storage: createJSONStorage(() => {
        // Use sessionStorage for visited nodes, localStorage for sound preference
        // We merge both on hydration
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return sessionStorage;
      }),
      partialize: (state) => ({
        visitedNodeIds: state.visitedNodeIds,
        soundEnabled: state.soundEnabled,
        // QG-8: activeOverlay NOT persisted — always resets to 'urgent' on page load
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Sound preference — persisted separately to localStorage
// ---------------------------------------------------------------------------

const SOUND_KEY = 'governada_cockpit_sound';

if (typeof window !== 'undefined') {
  // Hydrate sound preference from localStorage on module load
  try {
    const saved = localStorage.getItem(SOUND_KEY);
    if (saved !== null) {
      useCockpitStore.setState({ soundEnabled: saved === 'true' });
    }
  } catch {
    // Ignore storage errors
  }

  // Sync sound changes to localStorage
  useCockpitStore.subscribe((state, prevState) => {
    if (state.soundEnabled !== prevState.soundEnabled) {
      try {
        localStorage.setItem(SOUND_KEY, String(state.soundEnabled));
      } catch {
        // Ignore storage errors
      }
    }
  });
}
