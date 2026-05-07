export type MatchCapability = 'cerebro' | 'workspace_fallback';

export type MatchCapabilityReason =
  | 'reduced_motion'
  | 'low_memory_reduced_data'
  | 'no_webgl2'
  | null;

export interface MatchCapabilityResult {
  capability: MatchCapability;
  reason: MatchCapabilityReason;
}

function canUseMediaQuery(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function detectMatchCapabilityResult(): MatchCapabilityResult {
  if (typeof window === 'undefined') return { capability: 'cerebro', reason: null };

  if (canUseMediaQuery('(prefers-reduced-motion: reduce)')) {
    return { capability: 'workspace_fallback', reason: 'reduced_motion' };
  }

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const reducedData = canUseMediaQuery('(prefers-reduced-data: reduce)');
  if (memory != null && memory < 4 && reducedData) {
    return { capability: 'workspace_fallback', reason: 'low_memory_reduced_data' };
  }

  const canvas = document.createElement('canvas');
  const hasWebGL2 = Boolean(canvas.getContext('webgl2'));
  canvas.remove();

  if (!hasWebGL2) return { capability: 'workspace_fallback', reason: 'no_webgl2' };

  return { capability: 'cerebro', reason: null };
}

export function detectMatchCapability(): MatchCapability {
  return detectMatchCapabilityResult().capability;
}
