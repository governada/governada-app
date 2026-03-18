'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  BarChart3,
  StickyNote,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PanelId = 'agent' | 'intel' | 'notes' | 'vote';

interface StudioActionBarProps {
  mode?: 'review' | 'author';
  // Review mode
  currentVote?: 'Yes' | 'No' | 'Abstain' | null;
  onVoteSelect?: (vote: 'Yes' | 'No' | 'Abstain') => void;
  voteDisabled?: boolean;
  // Author mode (backward compat)
  activePanel?: PanelId | null;
  onPanelToggle?: (panel: PanelId) => void;
  contextActions?: ReactNode;
  // Shared
  statusInfo?: ReactNode;
}

const PANEL_BUTTONS: Array<{
  id: PanelId;
  label: string;
  Icon: typeof MessageSquare;
  shortcutKey: string;
  shortcutLabel: string;
}> = [
  {
    id: 'agent',
    label: 'Agent',
    Icon: MessageSquare,
    shortcutKey: 'c',
    shortcutLabel: 'Ctrl+Shift+C',
  },
  { id: 'intel', label: 'Intel', Icon: BarChart3, shortcutKey: 'i', shortcutLabel: 'Ctrl+Shift+I' },
  {
    id: 'notes',
    label: 'Notes',
    Icon: StickyNote,
    shortcutKey: 'n',
    shortcutLabel: 'Ctrl+Shift+N',
  },
];

function VoteButton({
  vote,
  onClick,
  disabled,
}: {
  vote: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    Yes: 'hover:border-teal-500/50 hover:bg-teal-500/5 hover:text-teal-400',
    No: 'hover:border-amber-600/50 hover:bg-amber-600/5 hover:text-amber-500',
    Abstain: 'hover:border-muted-foreground/50 hover:bg-muted/30',
  };
  const icons: Record<string, typeof CheckCircle2> = {
    Yes: CheckCircle2,
    No: XCircle,
    Abstain: MinusCircle,
  };
  const Icon = icons[vote] || MinusCircle;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium transition-all cursor-pointer',
        styles[vote],
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {vote}
    </button>
  );
}

export function StudioActionBar({
  mode = 'author',
  currentVote,
  onVoteSelect,
  voteDisabled,
  activePanel,
  onPanelToggle,
  contextActions,
  statusInfo,
}: StudioActionBarProps) {
  // Ctrl+Shift+C/I/N keyboard shortcuts for panel toggles (author mode only)
  useEffect(() => {
    if (!onPanelToggle || mode !== 'author') return;
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      const key = e.key.toLowerCase();
      const match = PANEL_BUTTONS.find((b) => b.shortcutKey === key);
      if (match) {
        e.preventDefault();
        onPanelToggle(match.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPanelToggle, mode]);

  if (mode === 'review') {
    return (
      <div className="sticky bottom-0 z-40 min-h-12 border-t border-border bg-background/95 backdrop-blur-sm px-4 pb-[env(safe-area-inset-bottom)] flex items-center shrink-0">
        {/* Left: status info / progress */}
        {statusInfo && <div className="flex items-center min-w-0 px-3">{statusInfo}</div>}
        {!statusInfo && <div className="flex-1" />}

        <div className="flex-1" />

        {/* Right: vote buttons + Explorer icon */}
        <div className="flex items-center gap-2">
          {currentVote ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Voted: {currentVote}
            </span>
          ) : (
            <>
              {(['Yes', 'No', 'Abstain'] as const).map((vote) => (
                <VoteButton
                  key={vote}
                  vote={vote}
                  onClick={() => onVoteSelect?.(vote)}
                  disabled={voteDisabled}
                />
              ))}
            </>
          )}

          {/* Governada Explorer */}
          <Link
            href="/"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-2"
            title="Explore Governada"
          >
            <Compass className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Author mode (default)
  return (
    <div className="sticky bottom-0 z-40 min-h-12 border-t border-border bg-background/95 backdrop-blur-sm px-4 pb-[env(safe-area-inset-bottom)] flex items-center shrink-0">
      {/* Left: panel toggle buttons */}
      <div className="flex items-center gap-1">
        {PANEL_BUTTONS.map(({ id, label, Icon, shortcutLabel }) => {
          const isActive = activePanel === id;
          return (
            <button
              key={id}
              onClick={() => onPanelToggle?.(id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
              )}
              title={`Toggle ${label} panel (${shortcutLabel})`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Center: status info */}
      {statusInfo && (
        <div className="flex-1 flex items-center justify-center min-w-0 px-3">{statusInfo}</div>
      )}

      {/* Spacer when no status */}
      {!statusInfo && <div className="flex-1" />}

      {/* Right: context actions */}
      {contextActions && <div className="flex items-center gap-2 shrink-0">{contextActions}</div>}
    </div>
  );
}
