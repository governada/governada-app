'use client';

/**
 * @deprecated Use `WorkspacePanels` instead. This component uses custom drag-resize
 * logic that is superseded by react-resizable-panels in WorkspacePanels.
 * Kept for backwards compatibility during migration.
 *
 * WorkspaceLayout — resizable two-panel layout for the governance workspace.
 *
 * Full viewport takeover (fixed inset-0) by default — the site sidebar
 * disappears and the editor gets maximum width. Pass `className="h-full"`
 * to embed inside another layout instead.
 *
 * Left panel: optional queue rail (collapsible). Center: editor. Right: agent chat (collapsible).
 * Bottom: status bar.
 */

import { useState, useCallback, useRef, type ReactNode } from 'react';

interface WorkspaceLayoutProps {
  toolbar: ReactNode;
  editor: ReactNode;
  chat: ReactNode;
  statusBar: ReactNode;
  /** Optional queue rail (review workspace only) */
  queueRail?: ReactNode;
  /** Override the root container class. Default renders as fullscreen overlay (fixed inset-0).
   *  Pass "h-full" to embed inside another layout without viewport takeover. */
  className?: string;
}

const MIN_EDITOR_WIDTH = 400;
const MIN_CHAT_WIDTH = 280;
const DEFAULT_CHAT_WIDTH = 380;
const QUEUE_COLLAPSED_WIDTH = 48;
const QUEUE_EXPANDED_WIDTH = 288; // md:w-72

export function WorkspaceLayout({
  toolbar,
  editor,
  chat,
  statusBar,
  queueRail,
  className,
}: WorkspaceLayoutProps) {
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isEmbedded = className?.includes('h-full');
  const isFullscreen = !isEmbedded;

  // Keyboard shortcut: Cmd+Shift+C to toggle chat — now handled by command registry
  // (view.toggle-agent command in CommandProvider)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newChatWidth = containerRect.right - ev.clientX;
      if (
        newChatWidth >= MIN_CHAT_WIDTH &&
        containerRect.width - newChatWidth >= MIN_EDITOR_WIDTH
      ) {
        setChatWidth(newChatWidth);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const toggleChat = useCallback(() => {
    setChatCollapsed((prev) => !prev);
  }, []);

  const toggleQueue = useCallback(() => {
    setQueueExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={`flex flex-col bg-background ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen' : (className ?? 'h-full')
      }`}
    >
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border">{toolbar}</div>

      {/* Main content: queue rail + editor + chat */}
      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
        {/* Queue rail (review workspace only) */}
        {queueRail && (
          <>
            <div
              className="shrink-0 border-r border-border overflow-hidden transition-[width] duration-200 ease-in-out"
              style={{ width: queueExpanded ? QUEUE_EXPANDED_WIDTH : QUEUE_COLLAPSED_WIDTH }}
            >
              {queueExpanded ? (
                <div className="h-full flex flex-col" style={{ width: QUEUE_EXPANDED_WIDTH }}>
                  <div className="shrink-0 flex items-center justify-between px-2 py-1.5 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground px-1">Queue</span>
                    <button
                      onClick={toggleQueue}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Collapse queue"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m11 17-5-5 5-5" />
                        <path d="m18 17-5-5 5-5" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">{queueRail}</div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center py-2 gap-2">
                  <button
                    onClick={toggleQueue}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Expand queue"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M9 3v18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Editor panel */}
        <div className="flex-1 min-w-0 overflow-y-auto">{editor}</div>

        {/* Resize handle */}
        {!chatCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className="w-1 cursor-col-resize bg-border hover:bg-primary/30 transition-colors shrink-0"
            role="separator"
            aria-label="Resize panels"
          />
        )}

        {/* Chat panel */}
        {!chatCollapsed && (
          <div className="shrink-0 border-l border-border" style={{ width: chatWidth }}>
            {chat}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 border-t border-border">
        <div className="flex items-center justify-between px-4 py-1.5 text-[11px]">
          {statusBar}
          <button
            onClick={toggleChat}
            className="text-muted-foreground hover:text-foreground transition-colors ml-4 shrink-0"
            title={chatCollapsed ? 'Show agent (Cmd+Shift+C)' : 'Hide agent (Cmd+Shift+C)'}
          >
            {chatCollapsed ? 'Show Agent' : 'Hide Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
