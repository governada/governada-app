'use client';

import { useEffect, useRef } from 'react';
import { useFocusStore } from '@/lib/workspace/focus';

/**
 * Pushes focus to the stack when `isOpen` becomes true, and restores
 * focus when `isOpen` becomes false. Ideal for modals, dialogs, and panels.
 *
 * Usage:
 * ```tsx
 * function MyModal({ open, onClose }) {
 *   useFocusRestore(open);
 *   return <Dialog open={open} onOpenChange={onClose} />;
 * }
 * ```
 */
export function useFocusRestore(isOpen: boolean) {
  const pushFocus = useFocusStore((s) => s.pushFocus);
  const popFocus = useFocusStore((s) => s.popFocus);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      // Opening — save the current focus
      pushFocus();
    } else if (!isOpen && prevOpen.current) {
      // Closing — restore previous focus
      popFocus();
    }
    prevOpen.current = isOpen;
  }, [isOpen, pushFocus, popFocus]);
}
