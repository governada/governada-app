'use client';

import { useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { commandRegistry } from '@/lib/workspace/commands';
import { useFocusStore } from '@/lib/workspace/focus';

/**
 * Registers J/K navigation commands for the draft list on the Author dashboard.
 *
 * These commands only activate when the 'drafts-list' is the active focus list
 * (set by `useFocusableList` in DraftsList).
 *
 * Follows the same pattern as useRegisterReviewCommands.
 */
export function useRegisterDraftListCommands() {
  useEffect(() => {
    const unregisters: Array<() => void> = [];

    unregisters.push(
      commandRegistry.register({
        id: 'author.list-down',
        label: 'Next Draft',
        shortcut: 'j',
        icon: ChevronDown,
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'drafts-list',
        execute: () => useFocusStore.getState().moveDown(),
      }),
    );

    unregisters.push(
      commandRegistry.register({
        id: 'author.list-up',
        label: 'Previous Draft',
        shortcut: 'k',
        icon: ChevronUp,
        section: 'actions',
        when: () => useFocusStore.getState().activeListId === 'drafts-list',
        execute: () => useFocusStore.getState().moveUp(),
      }),
    );

    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, []);
}
