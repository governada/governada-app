/**
 * Discovery event bus — lightweight decoupled communication
 * between page components and the milestone/celebration system.
 *
 * Pages emit events (e.g., 'proposal_viewed') without knowing
 * about the discovery system. MilestoneTrigger listens and
 * orchestrates celebrations.
 */

const bus = typeof window !== 'undefined' ? new EventTarget() : null;

export function emitDiscoveryEvent(type: string, detail?: Record<string, unknown>) {
  bus?.dispatchEvent(new CustomEvent(type, { detail }));
}

export function onDiscoveryEvent(type: string, handler: (e: CustomEvent) => void): () => void {
  if (!bus) return () => {};
  const listener = handler as EventListener;
  bus.addEventListener(type, listener);
  return () => bus.removeEventListener(type, listener);
}
