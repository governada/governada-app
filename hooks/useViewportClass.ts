'use client';

import { useEffect, useState } from 'react';

export type ViewportClass = 'mobile' | 'desktop';

const DESKTOP_QUERY = '(min-width: 1024px)';
const TOUCH_QUERY = '(pointer: coarse)';

export function getViewportClassSnapshot(): ViewportClass {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  return window.matchMedia(DESKTOP_QUERY).matches ? 'desktop' : 'mobile';
}

export function getIsTouchDeviceSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(TOUCH_QUERY).matches;
}

export function useViewportClass(): ViewportClass {
  const [viewportClass, setViewportClass] = useState<ViewportClass>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setViewportClass(query.matches ? 'desktop' : 'mobile');

    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return viewportClass;
}

export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(TOUCH_QUERY);
    const update = () => setIsTouchDevice(query.matches);

    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return isTouchDevice;
}
