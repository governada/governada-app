'use client';

/**
 * WorkspaceCommandPalette — unified command palette for the workspace.
 *
 * Uses cmdk (already installed) to show all registered commands grouped by section.
 * Opens with Cmd+K / Ctrl+K via the command registry.
 */

import { useCallback } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useCommands } from '@/hooks/useCommands';
import { commandRegistry, type CommandSection } from '@/lib/workspace/commands';
import { formatShortcut } from '@/lib/workspace/shortcut-display';

interface WorkspaceCommandPaletteProps {
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

export function WorkspaceCommandPalette({ open, onOpenChange }: WorkspaceCommandPaletteProps) {
  const commands = useCommands();

  const onSelect = useCallback(
    (commandId: string) => {
      onOpenChange(false);
      // Small delay to let the dialog close animation start before executing
      requestAnimationFrame(() => {
        commandRegistry.execute(commandId);
      });
    },
    [onOpenChange],
  );

  // Group commands by section
  const grouped = SECTION_ORDER.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    commands: commands.filter((c) => c.section === section),
  })).filter((g) => g.commands.length > 0);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Workspace command palette"
      className="fixed inset-0 z-[100]"
      loop
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl px-4">
        <div className="rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden ring-1 ring-white/5">
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border/50 px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Type a command..."
              className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No commands found.
            </Command.Empty>

            {grouped.map((group) => (
              <Command.Group
                key={group.section}
                heading={group.label}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {group.commands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <Command.Item
                      key={cmd.id}
                      value={`${cmd.id} ${cmd.label}`}
                      onSelect={() => onSelect(cmd.id)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">{cmd.label}</span>
                      {cmd.shortcut && <ShortcutBadge shortcut={cmd.shortcut} />}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer */}
          <div
            className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground"
            aria-hidden="true"
          >
            <span>
              <kbd className="font-mono">&uarr;&darr;</kbd> navigate{' '}
              <kbd className="font-mono">&crarr;</kbd> select <kbd className="font-mono">esc</kbd>{' '}
              close
            </span>
            <span>
              Press <kbd className="font-mono">?</kbd> for all shortcuts
            </span>
          </div>
        </div>
      </div>
    </Command.Dialog>
  );
}

// ---------------------------------------------------------------------------
// Shortcut Badge
// ---------------------------------------------------------------------------

function ShortcutBadge({ shortcut }: { shortcut: string }) {
  const display = formatShortcut(shortcut);

  // Split chord shortcuts (e.g. "G A") into separate badges
  const parts = display.split(' ');

  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
