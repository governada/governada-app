'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { X, MessageSquare, BarChart3, StickyNote, Vote, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'agent' | 'intel' | 'notes' | 'vote' | 'readiness';

interface StudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  width: number;
  onWidthChange: (width: number) => void;
  agentContent: ReactNode;
  intelContent?: ReactNode;
  notesContent?: ReactNode;
  voteContent?: ReactNode;
  readinessContent?: ReactNode;
}

const BASE_TABS: Array<{ id: TabId; label: string; Icon: typeof MessageSquare }> = [
  { id: 'agent', label: 'Agent', Icon: MessageSquare },
  { id: 'intel', label: 'Intel', Icon: BarChart3 },
  { id: 'notes', label: 'Notes', Icon: StickyNote },
];

const MIN_PANEL_WIDTH = 280;

export function StudioPanel({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  width,
  onWidthChange,
  agentContent,
  intelContent,
  notesContent,
  voteContent,
  readinessContent,
}: StudioPanelProps) {
  const isDragging = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);

  // Escape key closes panel — only when focus is within the panel itself
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as Node;
        const desktopPanel = panelRef.current;
        const mobilePanel = mobileSheetRef.current;
        if (
          (desktopPanel && desktopPanel.contains(target)) ||
          (mobilePanel && mobilePanel.contains(target))
        ) {
          e.preventDefault();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Max width: 50% of viewport
  const clampedWidth = Math.min(
    width,
    typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600,
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const newWidth = window.innerWidth - ev.clientX;
        if (newWidth >= MIN_PANEL_WIDTH && newWidth <= window.innerWidth * 0.5) {
          onWidthChange(newWidth);
        }
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onWidthChange],
  );

  // Build tabs dynamically: include vote only when voteContent provided, readiness when provided
  const TABS = [
    ...BASE_TABS,
    ...(voteContent ? [{ id: 'vote' as TabId, label: 'Vote', Icon: Vote }] : []),
    ...(readinessContent
      ? [{ id: 'readiness' as TabId, label: 'Readiness', Icon: ShieldCheck }]
      : []),
  ];

  const tabContent: Record<TabId, ReactNode> = {
    agent: agentContent,
    intel: intelContent ?? (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Intel panel coming soon
      </div>
    ),
    notes: notesContent ?? (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Notes panel coming soon
      </div>
    ),
    vote: voteContent ?? (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Vote panel coming soon
      </div>
    ),
    readiness: readinessContent ?? null,
  };

  // ---- Desktop panel (lg+) ----
  const desktopPanel = (
    <div
      ref={panelRef}
      className={cn(
        'hidden lg:flex flex-col relative border-l border-border bg-background shrink-0 overflow-hidden',
        'transition-[width,opacity] duration-200 ease-out',
      )}
      style={{ width: isOpen ? clampedWidth : 0 }}
    >
      {isOpen && (
        <>
          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent hover:bg-primary/30 transition-colors z-10"
            role="separator"
            aria-label="Resize panel"
          />

          {/* Tab bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
            <div className="flex items-center gap-0.5">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs rounded-sm transition-colors cursor-pointer',
                    activeTab === id
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              title="Close panel (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">{tabContent[activeTab]}</div>
        </>
      )}
    </div>
  );

  // ---- Mobile bottom sheet (<lg) ----
  const mobileSheet = isOpen && (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={mobileSheetRef}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-xl max-h-[80vh] flex flex-col border-t border-border pb-[env(safe-area-inset-bottom)]"
      >
        {/* Drag handle */}
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Tab bar */}
        <div className="flex items-center justify-between px-3 pb-1.5 border-b border-border shrink-0">
          <div className="flex items-center gap-0.5">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-xs rounded-sm transition-colors cursor-pointer',
                  activeTab === id
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            title="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3">{tabContent[activeTab]}</div>
      </div>
    </>
  );

  return (
    <>
      {desktopPanel}
      {mobileSheet}
    </>
  );
}
