'use client';

/**
 * ShortcutHints — Subtle keyboard shortcut labels for interactive elements.
 *
 * Shows small key labels in Work and Analyze density modes only.
 * Hidden in Browse mode to keep the UI clean for casual users.
 * Only rendered when the `keyboard_shortcuts` flag is enabled.
 */

import { cn } from '@/lib/utils';
import { useMode } from '@/components/providers/ModeProvider';
import { useShortcuts } from './ShortcutProvider';
import { formatShortcutKeys } from '@/lib/shortcuts';

interface ShortcutHintProps {
  /** The shortcut key sequence to display (e.g. "G P", "?") */
  keys: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a small shortcut hint badge.
 * Only visible in Work and Analyze modes when keyboard_shortcuts flag is on.
 */
export function ShortcutHint({ keys, className }: ShortcutHintProps) {
  const { mode } = useMode();
  const { enabled } = useShortcuts();

  // Only show in Work and Analyze modes
  if (!enabled || mode === 'browse') return null;

  const formatted = formatShortcutKeys(keys);

  return (
    <kbd
      className={cn(
        'inline-flex items-center px-1 py-0.5 rounded',
        'bg-muted/40 border border-border/30',
        'text-[9px] font-mono text-muted-foreground/50',
        'pointer-events-none select-none',
        className,
      )}
      aria-hidden="true"
    >
      {formatted}
    </kbd>
  );
}
