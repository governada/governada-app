'use client';

/**
 * WorkspaceLayout — resizable two-panel layout for the governance workspace.
 *
 * Left panel: editor. Right panel: agent chat (collapsible).
 * Bottom: status bar.
 */

import { useState, useCallback, useRef, type ReactNode } from 'react';

interface WorkspaceLayoutProps {
  toolbar: ReactNode;
  editor: ReactNode;
  chat: ReactNode;
  statusBar: ReactNode;
}

const MIN_EDITOR_WIDTH = 400;
const MIN_CHAT_WIDTH = 280;
const DEFAULT_CHAT_WIDTH = 380;

export function WorkspaceLayout({ toolbar, editor, chat, statusBar }: WorkspaceLayoutProps) {
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border">{toolbar}</div>

      {/* Main content: editor + chat */}
      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
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
          <div
            className="shrink-0 overflow-y-auto border-l border-border"
            style={{ width: chatWidth }}
          >
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
