'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  ChevronLeft,
  ChevronRight,
  Command,
  MessageSquare,
  BarChart3,
  StickyNote,
  PanelRight,
  Maximize2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudioQueueProgress } from './StudioQueueProgress';

interface ReadinessBadgeData {
  level: 'low' | 'moderate' | 'high' | 'strong';
  blockerCount: number;
}

interface StudioHeaderProps {
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  proposalType?: string;
  /** Compact readiness indicator in the header */
  readiness?: ReadinessBadgeData;
  /** Called when readiness badge is clicked */
  onReadinessClick?: () => void;
  queueProgress?: { current: number; total: number };
  onQueueJump?: (index: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  queueLabels?: string[];
  showModeSwitch?: boolean;
  mode?: 'edit' | 'review' | 'diff';
  onModeChange?: (mode: 'edit' | 'review' | 'diff') => void;
  actions?: ReactNode;
  /** Notification count for the bell icon */
  notificationCount?: number;
  /** Callback for Cmd+K button */
  onCommandPalette?: () => void;
  /** User segment badge label */
  segmentBadge?: { label: string; color: string };
  panelOpen?: boolean;
  activePanel?: 'agent' | 'intel' | 'notes' | 'vote' | 'readiness' | null;
  onPanelToggle?: (panel: 'agent' | 'intel' | 'notes' | 'vote' | 'readiness') => void;
  isFullWidth?: boolean;
  onFullWidthToggle?: () => void;
  onSearchToggle?: () => void;
  searchOpen?: boolean;
}

const MODE_LABELS: Record<string, string> = {
  edit: 'Edit',
  review: 'Review',
  diff: 'Diff',
};

export function StudioHeader({
  backHref = '/workspace',
  onBack,
  backLabel = 'governada',
  title,
  proposalType,
  queueProgress,
  onQueueJump,
  onPrev,
  onNext,
  queueLabels,
  showModeSwitch,
  mode = 'edit',
  onModeChange,
  actions,
  notificationCount = 0,
  onCommandPalette,
  segmentBadge,
  readiness,
  onReadinessClick,
  panelOpen,
  activePanel,
  onPanelToggle,
  isFullWidth,
  onFullWidthToggle,
  onSearchToggle,
  searchOpen,
}: StudioHeaderProps) {
  useEffect(() => {
    if (!onPanelToggle) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        onPanelToggle('agent');
      } else if (key === 'i') {
        e.preventDefault();
        onPanelToggle('intel');
      } else if (key === 'n') {
        e.preventDefault();
        onPanelToggle('notes');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPanelToggle]);
  const backContent = (
    <span className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="h-4 w-4 shrink-0" />
      <span className="text-sm font-semibold">{backLabel}</span>
    </span>
  );

  return (
    <header className="h-12 border-t-2 border-teal-500 border-b border-b-border bg-background px-4 flex items-center gap-3 shrink-0">
      {/* Back button */}
      {onBack ? (
        <button
          onClick={onBack}
          className="shrink-0 flex items-center p-1 rounded-md cursor-pointer"
        >
          {backContent}
        </button>
      ) : (
        <Link href={backHref} className="shrink-0 flex items-center p-1 rounded-md">
          {backContent}
        </Link>
      )}

      {/* Separator */}
      <div className="w-px h-5 bg-border shrink-0 hidden lg:block" />

      {/* Title + type badge */}
      {title && (
        <div className="hidden lg:flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate min-w-0">{title}</h1>
          {proposalType && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 shrink-0">
              {proposalType}
            </span>
          )}
        </div>
      )}

      {/* Spacer when title is hidden on mobile */}
      {!title && <div className="flex-1" />}
      {title && <div className="flex-1 lg:hidden" />}

      {/* Queue navigation */}
      {queueProgress && (
        <div className="hidden lg:flex items-center gap-1">
          {onPrev && (
            <button
              onClick={onPrev}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              title="Previous proposal (K)"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <StudioQueueProgress
            current={queueProgress.current}
            total={queueProgress.total}
            onDotClick={onQueueJump}
            labels={queueLabels}
          />
          {onNext && (
            <button
              onClick={onNext}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              title="Next proposal (J)"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {/* Mobile: dots only, no text */}
      {queueProgress && (
        <div className="flex lg:hidden items-center gap-1">
          {Array.from({ length: Math.min(queueProgress.total, 6) }, (_, i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                i + 1 < queueProgress.current && 'bg-primary',
                i + 1 === queueProgress.current && 'bg-primary ring-2 ring-primary/30',
                i + 1 > queueProgress.current && 'bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
      )}

      {/* Readiness badge */}
      {readiness && (
        <button
          onClick={onReadinessClick}
          className={cn(
            'hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer border',
            readiness.level === 'strong' || readiness.level === 'high'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : readiness.blockerCount > 0
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
          )}
          title="Submission readiness"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              readiness.level === 'strong' || readiness.level === 'high'
                ? 'bg-emerald-400'
                : readiness.blockerCount > 0
                  ? 'bg-destructive'
                  : 'bg-amber-400',
            )}
          />
          {readiness.blockerCount > 0
            ? `${readiness.blockerCount} blocker${readiness.blockerCount !== 1 ? 's' : ''}`
            : readiness.level === 'strong' || readiness.level === 'high'
              ? 'Ready'
              : 'Needs work'}
        </button>
      )}

      {/* Mode switcher */}
      {showModeSwitch && onModeChange && (
        <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
          {(['edit', 'review', 'diff'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn(
                'px-3 py-1 text-[11px] font-medium rounded-sm transition-colors cursor-pointer',
                mode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {/* Extra toolbar actions */}
      {actions}

      {/* Panel toggle buttons */}
      {onPanelToggle && (
        <div className="hidden sm:flex items-center gap-0.5 border-l border-border pl-2 ml-1">
          {(
            [
              {
                id: 'agent' as const,
                Icon: MessageSquare,
                label: 'Agent',
                shortcut: 'Ctrl+Shift+C',
              },
              {
                id: 'intel' as const,
                Icon: BarChart3,
                label: 'Intel',
                shortcut: 'Ctrl+Shift+I',
              },
              {
                id: 'notes' as const,
                Icon: StickyNote,
                label: 'Notes',
                shortcut: 'Ctrl+Shift+N',
              },
            ] as const
          ).map(({ id, Icon, label, shortcut }) => (
            <button
              key={id}
              onClick={() => onPanelToggle(id)}
              className={cn(
                'p-1.5 rounded-md transition-colors cursor-pointer',
                panelOpen && activePanel === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
              title={`${label} (${shortcut})`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          {onFullWidthToggle && (
            <button
              onClick={onFullWidthToggle}
              className={cn(
                'p-1.5 rounded-md transition-colors cursor-pointer ml-0.5',
                isFullWidth
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
              title={isFullWidth ? 'Show panel' : 'Full width'}
            >
              {isFullWidth ? (
                <PanelRight className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Right side controls */}
      <div className="flex items-center gap-1 shrink-0 relative">
        {/* Search */}
        {onSearchToggle && (
          <button
            onClick={onSearchToggle}
            className={cn(
              'p-1.5 rounded-md transition-colors cursor-pointer',
              searchOpen
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
            title="Search (Ctrl+F)"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Cmd+K */}
        <button
          onClick={() => {
            if (onCommandPalette) {
              onCommandPalette();
            } else {
              // Trigger the global CommandPalette via its keyboard listener
              document.dispatchEvent(
                new KeyboardEvent('keydown', {
                  key: 'k',
                  ctrlKey: true,
                  bubbles: true,
                }),
              );
            }
          }}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground rounded-md border border-border hover:bg-muted/50 transition-colors cursor-pointer"
          title="Command palette (Ctrl+K)"
        >
          <Command className="h-3 w-3" />
          <span className="hidden sm:inline">K</span>
        </button>

        {/* Notification bell */}
        <button
          className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Segment badge */}
        {segmentBadge && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: `${segmentBadge.color}20`, color: segmentBadge.color }}
          >
            {segmentBadge.label}
          </span>
        )}
      </div>
    </header>
  );
}
