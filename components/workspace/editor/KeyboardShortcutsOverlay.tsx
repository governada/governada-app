'use client';

/**
 * KeyboardShortcutsOverlay — Press "?" to see all available keyboard shortcuts.
 *
 * Inspired by Cursor and Linear's keyboard shortcut help overlays.
 * Shows all registered shortcuts grouped by category.
 */

import { useEffect, useState, useCallback } from 'react';
import { X, Keyboard } from 'lucide-react';

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

interface ShortcutGroup {
  label: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Navigation',
    shortcuts: [
      { keys: '/', description: 'Open slash command menu' },
      { keys: 'Ctrl+K', description: 'Command palette (AI instruction)' },
      { keys: 'Ctrl+Shift+C', description: 'Toggle Agent panel' },
      { keys: 'Ctrl+Shift+I', description: 'Toggle Intel panel' },
      { keys: 'Ctrl+Shift+N', description: 'Toggle Notes panel' },
      { keys: 'Esc', description: 'Close panel / dismiss menu' },
    ],
  },
  {
    label: 'Formatting',
    shortcuts: [
      { keys: 'Ctrl+B', description: 'Bold' },
      { keys: 'Ctrl+I', description: 'Italic' },
      { keys: 'Ctrl+Shift+S', description: 'Strikethrough' },
      { keys: 'Ctrl+Shift+X', description: 'Code' },
    ],
  },
  {
    label: 'Editing',
    shortcuts: [
      { keys: 'Tab', description: 'Accept AI suggestion / indent' },
      { keys: 'Ctrl+Z', description: 'Undo' },
      { keys: 'Ctrl+Shift+Z', description: 'Redo' },
      { keys: 'Ctrl+Enter', description: 'Send agent message' },
    ],
  },
  {
    label: 'Amendment',
    shortcuts: [
      { keys: '/amend', description: 'Propose amendment to section' },
      { keys: '/check-conflicts', description: 'Check for constitutional conflicts' },
      { keys: '/explain-impact', description: 'Explain governance impact' },
      { keys: '/compare-original', description: 'Show original text' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyboardShortcutsOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.getAttribute('contenteditable') === 'true' ||
        target.closest('[role="textbox"]')
      ) {
        return;
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    },
    [isOpen],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                {group.label}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    <kbd className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono text-muted-foreground">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-border/50 text-center">
          <span className="text-[10px] text-muted-foreground/50">
            Press{' '}
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 text-[9px] font-mono">
              ?
            </kbd>{' '}
            to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
