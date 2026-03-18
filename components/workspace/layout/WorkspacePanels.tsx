'use client';

/**
 * WorkspacePanels — resizable panel layout using react-resizable-panels v4.
 *
 * Replaces the custom drag-resize logic in WorkspaceLayout with a library
 * that handles persistence, keyboard accessibility, and cross-browser edge
 * cases out of the box.
 *
 * Layout: [Sidebar? | Main | Context?]
 * Toolbar is above, status bar is below.
 */

import { useCallback, type ReactNode } from 'react';
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels';
import { useWorkspaceStore } from '@/lib/workspace/store';

interface WorkspacePanelsProps {
  /** Left panel: navigation rail or queue */
  sidebar?: ReactNode;
  /** Center panel: editor or portfolio content */
  main: ReactNode;
  /** Right panel: agent, intel, notes, vote */
  context?: ReactNode;
  /** Top toolbar bar */
  toolbar: ReactNode;
  /** Bottom status bar */
  statusBar: ReactNode;
  /** Unique ID for persisting panel sizes (e.g. "editor", "review") */
  layoutId: string;
  /** Override the root container class. Default renders as fullscreen (h-screen). */
  className?: string;
}

export function WorkspacePanels({
  sidebar,
  main,
  context,
  toolbar,
  statusBar,
  layoutId,
  className,
}: WorkspacePanelsProps) {
  const contextPanel = useWorkspaceStore((s) => s.contextPanel);
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar);

  const sidebarRef = usePanelRef();
  const contextRef = usePanelRef();

  // Persist layout to localStorage
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `governada-workspace-${layoutId}`,
  });

  // When the sidebar panel resizes, check if it collapsed/expanded and sync to Zustand
  const handleSidebarResize = useCallback(
    (panelSize: { asPercentage: number; inPixels: number }) => {
      const isNowCollapsed = panelSize.asPercentage <= 3;
      if (isNowCollapsed && !sidebarCollapsed) {
        toggleSidebar();
      } else if (!isNowCollapsed && sidebarCollapsed) {
        toggleSidebar();
      }
    },
    [sidebarCollapsed, toggleSidebar],
  );

  // When the context panel resizes, sync collapse state to Zustand
  const handleContextResize = useCallback(
    (panelSize: { asPercentage: number; inPixels: number }) => {
      const isNowCollapsed = panelSize.asPercentage <= 1;
      const store = useWorkspaceStore.getState();
      if (isNowCollapsed && store.contextPanel !== null) {
        store.closePanel();
      } else if (!isNowCollapsed && store.contextPanel === null) {
        store.openPanel('agent');
      }
    },
    [],
  );

  // Build panel IDs array for layout persistence
  const panelIds: string[] = [];
  if (sidebar) panelIds.push('sidebar');
  panelIds.push('main');
  if (context) panelIds.push('context');

  return (
    <div className={className ?? 'flex flex-col h-screen bg-background'}>
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border">{toolbar}</div>

      {/* Main resizable area */}
      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="flex-1 min-h-0"
      >
        {/* Sidebar panel (optional) */}
        {sidebar && (
          <>
            <Panel
              id="sidebar"
              panelRef={sidebarRef}
              collapsible
              defaultSize="20%"
              minSize="5%"
              collapsedSize="3%"
              onResize={handleSidebarResize}
              className="hidden lg:block"
            >
              {sidebar}
            </Panel>
            <Separator className="hidden lg:block w-1 bg-border hover:bg-primary/30 transition-colors data-[separator]:active:bg-primary/40" />
          </>
        )}

        {/* Main content panel */}
        <Panel id="main" minSize="40%">
          <div className="h-full overflow-y-auto">{main}</div>
        </Panel>

        {/* Context panel (optional) */}
        {context && (
          <>
            <Separator className="hidden lg:block w-1 bg-border hover:bg-primary/30 transition-colors data-[separator]:active:bg-primary/40" />
            <Panel
              id="context"
              panelRef={contextRef}
              collapsible
              defaultSize={contextPanel !== null ? '25%' : '0%'}
              minSize="15%"
              collapsedSize="0%"
              onResize={handleContextResize}
              className="hidden lg:block"
            >
              {context}
            </Panel>
          </>
        )}
      </Group>

      {/* Status bar */}
      <div className="shrink-0 border-t border-border">{statusBar}</div>

      {/* Mobile: context panel renders as bottom sheet overlay, handled by StudioPanel */}
    </div>
  );
}
