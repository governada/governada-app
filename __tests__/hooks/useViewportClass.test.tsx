import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getIsTouchDeviceSnapshot,
  getViewportClassSnapshot,
  useIsTouchDevice,
  useViewportClass,
} from '@/hooks/useViewportClass';

function mockMatchMedia(matchesByQuery: Record<string, boolean>) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesByQuery[query] ?? false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ServerProbe() {
  const viewportClass = useViewportClass();
  const isTouch = useIsTouchDevice();
  return React.createElement('div', null, `${viewportClass}:${String(isTouch)}`);
}

describe('useViewportClass', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns SSR-safe desktop and non-touch defaults', () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    expect(getViewportClassSnapshot()).toBe('desktop');
    expect(getIsTouchDeviceSnapshot()).toBe(false);
    expect(renderToString(React.createElement(ServerProbe))).toContain('desktop:false');

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('returns desktop at the 1024px layout breakpoint', async () => {
    mockMatchMedia({
      '(min-width: 1024px)': true,
      '(pointer: coarse)': false,
    });

    const { result } = renderHook(() => useViewportClass());

    await waitFor(() => expect(result.current).toBe('desktop'));
  });

  it('returns mobile below the 1024px layout breakpoint', async () => {
    mockMatchMedia({
      '(min-width: 1024px)': false,
      '(pointer: coarse)': false,
    });

    const { result } = renderHook(() => useViewportClass());

    await waitFor(() => expect(result.current).toBe('mobile'));
  });

  it('detects coarse pointer separately from viewport width', async () => {
    mockMatchMedia({
      '(min-width: 1024px)': true,
      '(pointer: coarse)': true,
    });

    const { result } = renderHook(() => useIsTouchDevice());

    await waitFor(() => expect(result.current).toBe(true));
  });
});
