'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { commandRegistry, type Command } from '@/lib/workspace/commands';

/**
 * Returns all currently-available commands (filtered by `when` predicates).
 * Re-renders when the registry changes (commands added/removed).
 */
export function useCommands(): Command[] {
  const subscribe = useCallback((cb: () => void) => commandRegistry.subscribe(cb), []);
  const getSnapshot = useCallback(() => commandRegistry.getSnapshot(), []);

  // useSyncExternalStore triggers re-render when the snapshot reference changes.
  // Since we return the Map itself, we need to depend on it to recompute.
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return commandRegistry.getAvailable();
}

/**
 * Returns all registered commands (ignores `when` predicates).
 */
export function useAllCommands(): Command[] {
  const subscribe = useCallback((cb: () => void) => commandRegistry.subscribe(cb), []);
  const getSnapshot = useCallback(() => commandRegistry.getSnapshot(), []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return commandRegistry.getAll();
}
