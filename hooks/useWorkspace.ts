'use client';

import { useWorkspaceStore } from '@/lib/workspace/store';
import type { PanelId } from '@/lib/workspace/store';

/**
 * Full workspace state + actions. Use this when you need everything.
 */
export function useWorkspace() {
  return useWorkspaceStore();
}

/**
 * Panel-only slice — avoids re-renders from unrelated state changes.
 */
export function useWorkspacePanel() {
  return useWorkspaceStore((s) => ({
    contextPanel: s.contextPanel,
    openPanel: s.openPanel,
    closePanel: s.closePanel,
    togglePanel: s.togglePanel,
  }));
}

/**
 * Sidebar-only slice.
 */
export function useWorkspaceSidebar() {
  return useWorkspaceStore((s) => ({
    sidebarCollapsed: s.sidebarCollapsed,
    toggleSidebar: s.toggleSidebar,
  }));
}

/**
 * Focus level slice.
 */
export function useWorkspaceFocus() {
  return useWorkspaceStore((s) => ({
    focusLevel: s.focusLevel,
    setFocusLevel: s.setFocusLevel,
  }));
}

// Re-export the PanelId type for convenience
export type { PanelId };
