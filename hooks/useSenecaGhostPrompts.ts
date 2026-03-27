'use client';

/**
 * useSenecaGhostPrompts — Rotating ghost prompt suggestions for the Seneca input.
 *
 * Returns the current ghost prompt (rotating every 8 seconds) and the full list.
 * The consuming component handles crossfade/transition animation.
 */

import { useState, useEffect, useRef } from 'react';
import { getGhostPrompts } from '@/lib/intelligence/senecaPersonas';
import type { PanelRoute } from '@/hooks/useSenecaThread';

export interface SenecaGhostPromptsResult {
  /** The currently displayed ghost prompt */
  currentPrompt: string;
  /** All available ghost prompts for the current route */
  allPrompts: string[];
}

export function useSenecaGhostPrompts(panelRoute: PanelRoute): SenecaGhostPromptsResult {
  const prompts = getGhostPrompts(panelRoute);
  const [index, setIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset index when prompts change (route navigation)
  useEffect(() => {
    setIndex(0);
  }, [panelRoute]);

  // Rotate every 8 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % prompts.length);
    }, 8_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [prompts.length]);

  return {
    currentPrompt: prompts[index % prompts.length],
    allPrompts: prompts,
  };
}
