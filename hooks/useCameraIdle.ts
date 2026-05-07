'use client';

import { useEffect, useMemo, useState } from 'react';

export const MOUSE_IDLE_MS = 30_000;
export const CAMERA_IDLE_MS = 5_000;
export const CLUSTER_LINGER_MS = 2_000;
export const WHISPER_COOLDOWN_MS = 5 * 60_000;

const CAMERA_ACTIVITY_EVENT = 'governada:camera-activity';
const dismissedClusters = new Map<string, number>();

export interface UseCameraIdleInput {
  mouseIdleMs?: number;
  cameraIdleMs?: number;
}

export function useCameraIdle({
  mouseIdleMs = MOUSE_IDLE_MS,
  cameraIdleMs = CAMERA_IDLE_MS,
}: UseCameraIdleInput = {}) {
  const [lastMouseActivity, setLastMouseActivity] = useState(() => Date.now());
  const [lastCameraActivity, setLastCameraActivity] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const markMouseActivity = () => setLastMouseActivity(Date.now());
    const markCameraActivity = () => setLastCameraActivity(Date.now());

    const mouseEvents = ['mousemove', 'pointermove', 'wheel', 'touchstart', 'keydown'] as const;
    for (const eventName of mouseEvents) {
      window.addEventListener(eventName, markMouseActivity, { passive: true });
    }
    window.addEventListener(CAMERA_ACTIVITY_EVENT, markCameraActivity);

    return () => {
      for (const eventName of mouseEvents) {
        window.removeEventListener(eventName, markMouseActivity);
      }
      window.removeEventListener(CAMERA_ACTIVITY_EVENT, markCameraActivity);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  return useMemo(
    () => now - lastMouseActivity >= mouseIdleMs && now - lastCameraActivity >= cameraIdleMs,
    [cameraIdleMs, lastCameraActivity, lastMouseActivity, mouseIdleMs, now],
  );
}

export function dispatchCameraActivity() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CAMERA_ACTIVITY_EVENT));
}

export function markClusterWhisperDismissed(clusterId: string, dismissedAtMs = Date.now()) {
  dismissedClusters.set(clusterId, dismissedAtMs);
}

export function clearClusterWhisperCooldown(clusterId: string) {
  dismissedClusters.delete(clusterId);
}

export function clearClusterWhisperCooldowns() {
  dismissedClusters.clear();
}

export function isClusterWhisperCoolingDown(clusterId: string, now = Date.now()) {
  const dismissedAt = dismissedClusters.get(clusterId);
  if (!dismissedAt) return false;

  if (dismissedAt + WHISPER_COOLDOWN_MS <= now) {
    dismissedClusters.delete(clusterId);
    return false;
  }

  return true;
}
