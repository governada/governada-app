// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMERA_IDLE_MS,
  MOUSE_IDLE_MS,
  WHISPER_COOLDOWN_MS,
  clearClusterWhisperCooldowns,
  dispatchCameraActivity,
  isClusterWhisperCoolingDown,
  markClusterWhisperDismissed,
  useCameraIdle,
} from '@/hooks/useCameraIdle';

describe('useCameraIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    clearClusterWhisperCooldowns();
  });

  afterEach(() => {
    clearClusterWhisperCooldowns();
    vi.useRealTimers();
  });

  it('waits for both mouse and camera idle thresholds', () => {
    const { result } = renderHook(() => useCameraIdle());

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(CAMERA_IDLE_MS + 100);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(MOUSE_IDLE_MS - CAMERA_IDLE_MS);
    });
    expect(result.current).toBe(true);
  });

  it('resets the mouse threshold on pointer activity', () => {
    const { result } = renderHook(() => useCameraIdle());

    act(() => {
      vi.advanceTimersByTime(MOUSE_IDLE_MS - 1);
      window.dispatchEvent(new Event('pointermove'));
      vi.advanceTimersByTime(CAMERA_IDLE_MS + 100);
    });

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(MOUSE_IDLE_MS);
    });
    expect(result.current).toBe(true);
  });

  it('resets the camera threshold on camera activity', () => {
    const { result } = renderHook(() => useCameraIdle());

    act(() => {
      vi.advanceTimersByTime(MOUSE_IDLE_MS + 100);
    });
    expect(result.current).toBe(true);

    act(() => {
      dispatchCameraActivity();
      vi.advanceTimersByTime(CAMERA_IDLE_MS - 1);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe(true);
  });

  it('enforces a five-minute per-cluster whisper dismissal cooldown', () => {
    markClusterWhisperDismissed('cluster-a', 1_000);

    expect(isClusterWhisperCoolingDown('cluster-a', 1_000 + WHISPER_COOLDOWN_MS - 1)).toBe(true);
    expect(isClusterWhisperCoolingDown('cluster-b', 1_000 + WHISPER_COOLDOWN_MS - 1)).toBe(false);
    expect(isClusterWhisperCoolingDown('cluster-a', 1_000 + WHISPER_COOLDOWN_MS)).toBe(false);
  });
});
