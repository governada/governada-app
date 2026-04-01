import { describe, it, expect } from 'vitest';
import { composeFocusLayers, type FocusLayer } from '@/lib/globe/focusComposer';

describe('composeFocusLayers', () => {
  it('returns null intent for empty layers', () => {
    const result = composeFocusLayers([]);
    expect(result.focusedIds).toBeNull();
  });

  it('returns single layer intent unchanged', () => {
    const layer: FocusLayer = {
      id: 'primary',
      priority: 0,
      intent: {
        focusedIds: new Set(['a', 'b']),
        intensities: new Map([
          ['a', 0.8],
          ['b', 0.5],
        ]),
        focusColor: '#ff0000',
      },
    };
    const result = composeFocusLayers([layer]);
    expect(result).toBe(layer.intent);
  });

  it('unions focusedIds across layers', () => {
    const layers: FocusLayer[] = [
      { id: 'a', priority: 1, intent: { focusedIds: new Set(['x', 'y']) } },
      { id: 'b', priority: 0, intent: { focusedIds: new Set(['y', 'z']) } },
    ];
    const result = composeFocusLayers(layers);
    const ids = result.focusedIds as Set<string>;
    expect(ids.has('x')).toBe(true);
    expect(ids.has('y')).toBe(true);
    expect(ids.has('z')).toBe(true);
  });

  it('takes max intensity per node', () => {
    const layers: FocusLayer[] = [
      {
        id: 'a',
        priority: 1,
        intent: { focusedIds: new Set(['x']), intensities: new Map([['x', 0.3]]) },
      },
      {
        id: 'b',
        priority: 0,
        intent: { focusedIds: new Set(['x']), intensities: new Map([['x', 0.8]]) },
      },
    ];
    const result = composeFocusLayers(layers);
    expect(result.intensities?.get('x')).toBe(0.8);
  });

  it('highest priority wins color per node', () => {
    const layers: FocusLayer[] = [
      {
        id: 'a',
        priority: 2,
        intent: { focusedIds: new Set(['x']), colorOverrides: new Map([['x', '#ff0000']]) },
      },
      {
        id: 'b',
        priority: 0,
        intent: { focusedIds: new Set(['x']), colorOverrides: new Map([['x', '#00ff00']]) },
      },
    ];
    const result = composeFocusLayers(layers);
    expect(result.colorOverrides?.get('x')).toBe('#ff0000');
  });

  it('unions pulsingNodeIds', () => {
    const layers: FocusLayer[] = [
      { id: 'a', priority: 1, intent: { focusedIds: new Set(), pulsingNodeIds: new Set(['x']) } },
      { id: 'b', priority: 0, intent: { focusedIds: new Set(), pulsingNodeIds: new Set(['y']) } },
    ];
    const result = composeFocusLayers(layers);
    expect(result.pulsingNodeIds?.has('x')).toBe(true);
    expect(result.pulsingNodeIds?.has('y')).toBe(true);
  });

  it('concats highlightedRegions', () => {
    const layers: FocusLayer[] = [
      { id: 'a', priority: 1, intent: { focusedIds: new Set(), highlightedRegions: ['cluster1'] } },
      { id: 'b', priority: 0, intent: { focusedIds: new Set(), highlightedRegions: ['cluster2'] } },
    ];
    const result = composeFocusLayers(layers);
    expect(result.highlightedRegions).toContain('cluster1');
    expect(result.highlightedRegions).toContain('cluster2');
  });

  it('visual params come from highest priority', () => {
    const layers: FocusLayer[] = [
      { id: 'a', priority: 2, intent: { focusedIds: new Set(), focusColor: '#red' } },
      { id: 'b', priority: 5, intent: { focusedIds: new Set(), focusColor: '#blue' } },
    ];
    const result = composeFocusLayers(layers);
    expect(result.focusColor).toBe('#blue');
  });

  it('forceActive is true if any layer has it', () => {
    const layers: FocusLayer[] = [
      { id: 'a', priority: 1, intent: { focusedIds: new Set(), forceActive: false } },
      { id: 'b', priority: 0, intent: { focusedIds: new Set(), forceActive: true } },
    ];
    const result = composeFocusLayers(layers);
    expect(result.forceActive).toBe(true);
  });
});
