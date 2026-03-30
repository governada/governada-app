/**
 * Choreography Scheduler — Cancellable, inspectable command sequences.
 *
 * Replaces raw setTimeout chains for globe command sequences.
 * Provides:
 * - Named choreographies with computed totalDuration
 * - Cancellable handles (exit mid-match → no orphaned globe commands)
 * - Clean re-entry (new play cancels active sequence)
 */

import type { GlobeCommand } from '@/lib/globe/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChoreographyStep {
  command: GlobeCommand;
  /** Delay in ms AFTER the previous step completes. First step's delay is from play() call. */
  delayMs: number;
  /** Optional label for debugging/logging */
  label?: string;
}

export interface Choreography {
  name: string;
  steps: ChoreographyStep[];
}

export interface ChoreographyHandle {
  /** Cancel the remaining steps */
  cancel: () => void;
  /** Resolves when all steps have executed (or rejects on cancel) */
  done: Promise<void>;
  /** Total duration of the choreography in ms */
  totalDuration: number;
}

// ---------------------------------------------------------------------------
// Compute total duration
// ---------------------------------------------------------------------------

export function getTotalDuration(choreography: Choreography): number {
  return choreography.steps.reduce((sum, step) => sum + step.delayMs, 0);
}

// ---------------------------------------------------------------------------
// Choreographer factory
// ---------------------------------------------------------------------------

export function createChoreographer(dispatch: (command: GlobeCommand) => void) {
  let activeTimers: ReturnType<typeof setTimeout>[] = [];
  let cancelledRef = { cancelled: false };

  function cancelAll() {
    cancelledRef.cancelled = true;
    for (const t of activeTimers) clearTimeout(t);
    activeTimers = [];
  }

  function play(choreography: Choreography): ChoreographyHandle {
    // Cancel any active sequence before starting a new one
    cancelAll();

    const timers: ReturnType<typeof setTimeout>[] = [];
    const ref = { cancelled: false };
    cancelledRef = ref;
    activeTimers = timers;

    const totalDuration = getTotalDuration(choreography);

    let rejectDone: ((err: Error) => void) | null = null;

    const done = new Promise<void>((resolve, reject) => {
      rejectDone = reject;
      let accumulatedDelay = 0;

      for (let i = 0; i < choreography.steps.length; i++) {
        const step = choreography.steps[i];
        accumulatedDelay += step.delayMs;

        const isLast = i === choreography.steps.length - 1;
        const timer = setTimeout(() => {
          if (ref.cancelled) return;
          dispatch(step.command);
          if (isLast) resolve();
        }, accumulatedDelay);

        timers.push(timer);
      }

      // Edge case: empty choreography resolves immediately
      if (choreography.steps.length === 0) {
        resolve();
      }
    });

    return {
      cancel: () => {
        ref.cancelled = true;
        for (const t of timers) clearTimeout(t);
        rejectDone?.(new Error('Choreography cancelled'));
      },
      done: done.catch(() => {}), // Swallow cancel rejections — caller doesn't need to handle
      totalDuration,
    };
  }

  return { play, cancelAll };
}
