import { describe, it, expect } from 'vitest';
import { serializeSnapshot, deserializeSnapshot } from '@/lib/globe/sceneSnapshot';

describe('sceneSnapshot', () => {
  const testParams = {
    focusedIds: new Set(['drep_abc', 'drep_xyz']),
    colorOverrides: new Map([
      ['drep_abc', '#ff0000'],
      ['drep_xyz', '#00ff00'],
    ]),
    cameraPosition: [5.123, 2.456, 10.789] as [number, number, number],
    cameraTarget: [0.5, 0.3, 0.1] as [number, number, number],
    zoomDistance: 12.34,
    scanProgress: 0.75,
    activeLayers: ['primary', 'voteSplit'],
  };

  it('roundtrip: serialize then deserialize', () => {
    const encoded = serializeSnapshot(testParams);
    const result = deserializeSnapshot(encoded);

    expect(result).not.toBeNull();
    expect(result!.focusedIds.has('drep_abc')).toBe(true);
    expect(result!.focusedIds.has('drep_xyz')).toBe(true);
    expect(result!.colorOverrides.get('drep_abc')).toBe('#ff0000');
    expect(result!.cameraPosition[0]).toBeCloseTo(5.12, 1);
    expect(result!.zoomDistance).toBeCloseTo(12.34, 1);
    expect(result!.scanProgress).toBe(0.75);
    expect(result!.activeLayers).toContain('primary');
  });

  it('handles empty state', () => {
    const encoded = serializeSnapshot({
      focusedIds: new Set(),
      colorOverrides: null,
      cameraPosition: [0, 3, 14],
      cameraTarget: [0, 0, 0],
      zoomDistance: 14,
    });
    const result = deserializeSnapshot(encoded);

    expect(result).not.toBeNull();
    expect(result!.focusedIds.size).toBe(0);
    expect(result!.colorOverrides.size).toBe(0);
  });

  it('returns null for invalid input', () => {
    expect(deserializeSnapshot('invalid-not-base64!!!')).toBeNull();
    expect(deserializeSnapshot('')).toBeNull();
  });

  it('encoded string is URL-safe', () => {
    const encoded = serializeSnapshot(testParams);
    // Base64url should not contain +, /, or =
    expect(encoded).not.toMatch(/[+/=]/);
  });
});
