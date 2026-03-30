/**
 * Behavior Registry — register and execute globe behaviors by command type.
 *
 * Behaviors are registered globally. When a command is dispatched, the registry
 * checks if any registered behavior handles it. If so, the behavior executes.
 * If not, the caller falls back to direct ref calls.
 */

import type { GlobeCommand } from '@/lib/globe/types';
import type { GlobeBehavior, BehaviorContext } from './types';

const behaviors: GlobeBehavior[] = [];

export function registerBehavior(behavior: GlobeBehavior): void {
  // Replace existing behavior with same ID (handles React StrictMode remount with fresh closures)
  const idx = behaviors.findIndex((b) => b.id === behavior.id);
  if (idx >= 0) {
    behaviors[idx] = behavior;
  } else {
    behaviors.push(behavior);
  }
}

export function unregisterBehavior(id: string): void {
  const idx = behaviors.findIndex((b) => b.id === id);
  if (idx >= 0) behaviors.splice(idx, 1);
}

/**
 * Try to execute a command via a registered behavior.
 * Returns true if a behavior handled it, false if no behavior matched.
 */
export function executeBehavior(command: GlobeCommand, ctx: BehaviorContext): boolean {
  for (const behavior of behaviors) {
    if (behavior.handles.includes(command.type)) {
      behavior.execute(command, ctx);
      return true;
    }
  }
  return false;
}

/**
 * Run cleanup on all registered behaviors.
 * Call when exiting a mode (e.g., match mode → idle).
 */
export function cleanupBehaviors(): void {
  for (const behavior of behaviors) {
    behavior.cleanup?.();
  }
}
