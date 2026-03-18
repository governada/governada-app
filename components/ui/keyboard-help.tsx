'use client';

/**
 * KeyboardHelpOverlay — shows all registered keyboard shortcuts grouped by section.
 *
 * Triggered by pressing `?` (registered as a command).
 * Uses the command registry to dynamically list all shortcuts.
 */

import { X } from 'lucide-react';
import { useAllCommands } from '@/hooks/useCommands';
import { formatShortcut } from '@/lib/workspace/shortcut-display';
import type { CommandSection } from '@/lib/workspace/commands';

interface KeyboardHelpOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_LABELS: Record<CommandSection, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  view: 'View',
  ai: 'AI',
};

const SECTION_ORDER: CommandSection[] = ['navigation', 'actions', 'view', 'ai'];

export function KeyboardHelpOverlay({ open, onOpenChange }: KeyboardHelpOverlayProps) {
  const allCommands = useAllCommands();

  if (!open) return null;

  // Group commands that have shortcuts by section
  const grouped = SECTION_ORDER.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    commands: allCommands.filter((c) => c.section === section && c.shortcut),
  })).filter((g) => g.commands.length > 0);

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-md px-4">
        <div className="rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/5">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {grouped.map((group) => (
              <div key={group.section}>
                <h3 className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.commands.map((cmd) => (
                    <div key={cmd.id} className="flex items-center justify-between">
                      <span className="text-sm">{cmd.label}</span>
                      {cmd.shortcut && <ShortcutBadge shortcut={cmd.shortcut} />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border/50 px-5 py-3 text-center text-[11px] text-muted-foreground">
            Press{' '}
            <kbd className="font-mono px-1 rounded bg-muted/50 border border-border/50">?</kbd> to
            close
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shortcut Badge (same as in command-palette, small enough to duplicate)
// ---------------------------------------------------------------------------

function ShortcutBadge({ shortcut }: { shortcut: string }) {
  const display = formatShortcut(shortcut);
  const parts = display.split(' ');

  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex h-6 items-center rounded border border-border/50 bg-muted/50 px-2 font-mono text-[11px] text-muted-foreground"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
