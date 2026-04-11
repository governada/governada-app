'use client';

import { useEffect, useRef } from 'react';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';

export function MatchRouteActivator() {
  const mode = useSenecaThreadStore((state) => state.mode);
  const isOpen = useSenecaThreadStore((state) => state.isOpen);
  const startMatch = useSenecaThreadStore((state) => state.startMatch);
  const attemptedAutoStart = useRef(false);

  useEffect(() => {
    if (attemptedAutoStart.current) return;
    attemptedAutoStart.current = true;

    if (!(mode === 'matching' && isOpen)) {
      startMatch();
    }
  }, [isOpen, mode, startMatch]);

  if (mode === 'matching' && isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-28 z-30 flex justify-center px-4">
      <button
        type="button"
        onClick={startMatch}
        className="pointer-events-auto rounded-full border border-primary/30 bg-black/75 px-4 py-2 text-sm font-semibold text-primary shadow-lg shadow-black/30 backdrop-blur"
      >
        Start Match
      </button>
    </div>
  );
}
