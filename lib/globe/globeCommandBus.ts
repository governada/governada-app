/**
 * Globe Command Bus — centralized dispatch and subscription for globe commands.
 *
 * Replaces scattered `window.dispatchEvent(new CustomEvent('senecaGlobeCommand', ...))`
 * calls across 6+ files with a single typed utility.
 *
 * Uses CustomEvent under the hood — this is necessary because R3F's <Canvas>
 * creates a separate React reconciler tree, and window events are the only
 * truly shared transport.
 */

import type { GlobeCommand } from './types';

const EVENT_NAME = 'senecaGlobeCommand';

/** Dispatch a globe command to all listeners (SSR-safe) */
export function dispatchGlobeCommand(command: GlobeCommand): void {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line no-console
  console.log('%c[CommandBus] DISPATCH:', 'color: cyan', command.type, command);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: command }));
}

/** Subscribe to globe commands. Returns a cleanup function. */
export function onGlobeCommand(handler: (command: GlobeCommand) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (e: Event) => {
    handler((e as CustomEvent<GlobeCommand>).detail);
  };

  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
