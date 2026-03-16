'use client';

import { useEffect } from 'react';

interface KeyboardHandlers {
  onYes?: () => void;
  onNo?: () => void;
  onAbstain?: () => void;
  onSnooze?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSubmit?: () => void;
}

/**
 * Keyboard shortcuts for the review workspace.
 *
 * y = Yes, n = No, a = Abstain, s = Snooze
 * ArrowRight = Next, ArrowLeft = Prev
 * Cmd+Enter / Ctrl+Enter = Submit
 *
 * Skips when focus is on input/textarea elements.
 */
export function useKeyboardShortcuts(handlers: KeyboardHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;

      // Skip when typing in input fields
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        // Allow Cmd+Enter / Ctrl+Enter in textareas for submit
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && handlers.onSubmit) {
          e.preventDefault();
          handlers.onSubmit();
        }
        return;
      }

      switch (e.key) {
        case 'y':
          e.preventDefault();
          handlers.onYes?.();
          break;
        case 'n':
          e.preventDefault();
          handlers.onNo?.();
          break;
        case 'a':
          e.preventDefault();
          handlers.onAbstain?.();
          break;
        case 's':
          e.preventDefault();
          handlers.onSnooze?.();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlers.onNext?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onPrev?.();
          break;
        case 'Enter':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handlers.onSubmit?.();
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
