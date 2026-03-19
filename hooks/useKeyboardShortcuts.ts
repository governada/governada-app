'use client';

/**
 * useKeyboardShortcuts — Global keyboard shortcut handler.
 *
 * Supports chord sequences (G then H = Go Home), modified keys (Cmd+Shift+M),
 * and single-key shortcuts (?). Ignores input when focus is in text fields.
 *
 * Feature-flagged behind `keyboard_shortcuts`.
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  isInputFocused,
  normalizeKey,
  parseShortcutKeys,
  type ShortcutDefinition,
} from '@/lib/shortcuts';

/** Time window for chord second key (ms) */
const CHORD_TIMEOUT = 500;

export function useKeyboardShortcuts(
  shortcuts: ShortcutDefinition[],
  options: {
    enabled?: boolean;
    pathname?: string;
  } = {},
) {
  const { enabled = true, pathname } = options;
  const chordFirstKeyRef = useRef<string | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  const clearChord = useCallback(() => {
    chordFirstKeyRef.current = null;
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      if (isInputFocused()) {
        clearChord();
        return;
      }

      const currentShortcuts = shortcutsRef.current;
      const pressedKey = normalizeKey(e);

      // If we have a pending chord first key, check for chord completions
      if (chordFirstKeyRef.current) {
        const firstKey = chordFirstKeyRef.current;
        clearChord();

        // Find matching chord
        const match = currentShortcuts.find((s) => {
          const parsed = parseShortcutKeys(s.keys);
          if (!parsed.isChord) return false;
          if (parsed.firstKey !== firstKey) return false;
          if (parsed.secondKey !== pressedKey) return false;
          // Check context
          if (s.contextPaths && pathname) {
            return s.contextPaths.some((p) => pathname.startsWith(p));
          }
          return true;
        });

        if (match) {
          e.preventDefault();
          match.action();
          return;
        }
        // No chord match — fall through to check as single key
      }

      // Check for chord-starting keys (single uppercase letter without modifiers)
      if (pressedKey.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const isChordStarter = currentShortcuts.some((s) => {
          const parsed = parseShortcutKeys(s.keys);
          return parsed.isChord && parsed.firstKey === pressedKey;
        });

        if (isChordStarter) {
          chordFirstKeyRef.current = pressedKey;
          chordTimerRef.current = setTimeout(() => {
            chordFirstKeyRef.current = null;
            chordTimerRef.current = null;
          }, CHORD_TIMEOUT);
          // Don't prevent default yet — the first key might not lead to a chord
          return;
        }
      }

      // Check for single/modified key shortcuts
      const match = currentShortcuts.find((s) => {
        const parsed = parseShortcutKeys(s.keys);
        if (parsed.isChord) return false;

        // Build expected normalized key
        const expectedParts: string[] = [];
        if (parsed.modifiers.cmd) expectedParts.push('Cmd');
        if (parsed.modifiers.shift) expectedParts.push('Shift');
        if (parsed.modifiers.alt) expectedParts.push('Alt');
        expectedParts.push(parsed.firstKey);
        const expectedKey = expectedParts.join('+');

        if (pressedKey !== expectedKey) return false;

        // Check context
        if (s.contextPaths && pathname) {
          return s.contextPaths.some((p) => pathname.startsWith(p));
        }
        return true;
      });

      if (match) {
        e.preventDefault();
        match.action();
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      clearChord();
    };
  }, [enabled, pathname, clearChord]);
}
