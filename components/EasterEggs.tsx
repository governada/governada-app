'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

function fireConstellationBurst() {
  import('canvas-confetti').then(({ default: confetti }) => {
    const colors = ['#06b6d4', '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#dc2626'];
    const end = Date.now() + 3000;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60 + Math.random() * 60,
        spread: 60,
        origin: { x: Math.random(), y: Math.random() * 0.6 },
        colors: [colors[Math.floor(Math.random() * colors.length)]],
        ticks: 100,
        gravity: 0.6,
        scalar: 0.8,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  });
}

export function EasterEggs() {
  const pathname = usePathname();
  const bufferRef = useRef<string[]>([]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (pathname !== '/') return;
      bufferRef.current.push(e.key);
      if (bufferRef.current.length > KONAMI.length) {
        bufferRef.current = bufferRef.current.slice(-KONAMI.length);
      }
      if (
        bufferRef.current.length === KONAMI.length &&
        bufferRef.current.every((k, i) => k === KONAMI[i])
      ) {
        fireConstellationBurst();
        bufferRef.current = [];
      }
    },
    [pathname],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return null;
}
