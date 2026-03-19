'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PanelId = 'agent' | 'intel' | 'notes' | 'vote';

export interface WorkspaceState {
  // Entity selection (NOT persisted — driven by URL)
  currentDraftId: string | null;
  currentProposalId: string | null;

  // Panel preferences (persisted)
  sidebarCollapsed: boolean;
  contextPanel: PanelId | null;
  focusLevel: 0 | 1 | 2;

  // Author view preferences (persisted)
  authorViewMode: 'kanban' | 'list';
  authorFilter: string;

  // Reviewer portfolio preferences (persisted)
  reviewViewMode: 'kanban' | 'list';
  reviewFilter: string;

  // Review queue state (NOT persisted — derived from queue data)
  reviewQueueIndex: number;
}

export interface WorkspaceActions {
  setCurrentDraft: (draftId: string | null) => void;
  setCurrentProposal: (proposalId: string | null) => void;
  toggleSidebar: () => void;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelId) => void;
  setFocusLevel: (level: 0 | 1 | 2) => void;
  setAuthorViewMode: (mode: 'kanban' | 'list') => void;
  setAuthorFilter: (filter: string) => void;
  setReviewViewMode: (mode: 'kanban' | 'list') => void;
  setReviewFilter: (filter: string) => void;
  setReviewQueueIndex: (index: number) => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      // --- State ---
      currentDraftId: null,
      currentProposalId: null,
      sidebarCollapsed: false,
      contextPanel: 'agent',
      focusLevel: 0,
      authorViewMode: 'kanban',
      authorFilter: '',
      reviewViewMode: 'kanban',
      reviewFilter: '',
      reviewQueueIndex: 0,

      // --- Actions ---
      setCurrentDraft: (draftId) => set({ currentDraftId: draftId }),
      setCurrentProposal: (proposalId) => set({ currentProposalId: proposalId }),

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      openPanel: (panel) => set({ contextPanel: panel }),

      closePanel: () => set({ contextPanel: null }),

      togglePanel: (panel) =>
        set((s) => ({
          contextPanel: s.contextPanel === panel ? null : panel,
        })),

      setFocusLevel: (level) =>
        set({
          focusLevel: level,
          // Focus level 1+ hides the context panel
          ...(level > 0 ? { contextPanel: null } : {}),
        }),

      setAuthorViewMode: (mode) => set({ authorViewMode: mode }),
      setAuthorFilter: (filter) => set({ authorFilter: filter }),
      setReviewViewMode: (mode) => set({ reviewViewMode: mode }),
      setReviewFilter: (filter) => set({ reviewFilter: filter }),
      setReviewQueueIndex: (index) => set({ reviewQueueIndex: index }),
    }),
    {
      name: 'governada-workspace',
      // Only persist panel preferences — not entity selection or transient state
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        contextPanel: state.contextPanel,
        focusLevel: state.focusLevel,
        authorViewMode: state.authorViewMode,
        reviewViewMode: state.reviewViewMode,
      }),
    },
  ),
);
