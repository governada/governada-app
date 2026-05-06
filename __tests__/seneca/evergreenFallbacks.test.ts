import { describe, expect, it } from 'vitest';
import { EVERGREEN_FALLBACKS, getEvergreenFallback } from '@/lib/seneca/evergreenFallbacks';
import { CINEMATIC_STATES } from '@/types/cinematic';

describe('evergreen fallbacks', () => {
  it('provides one fallback per cinematic state', () => {
    expect(Object.keys(EVERGREEN_FALLBACKS).sort()).toEqual([...CINEMATIC_STATES].sort());

    for (const state of CINEMATIC_STATES) {
      expect(getEvergreenFallback(state)).toEqual(expect.any(String));
      expect(getEvergreenFallback(state).length).toBeGreaterThan(40);
    }
  });
});
