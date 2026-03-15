'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'governada_explore_path';
const MAX_STEPS = 5;

export interface ExploreStep {
  type: 'drep' | 'proposal' | 'pool' | 'cc';
  id: string;
  label: string;
  href: string;
}

function loadPath(): ExploreStep[] {
  try {
    if (typeof window === 'undefined') return [];
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePath(steps: ExploreStep[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
}

/**
 * Manages the Explore Path — a session-scoped breadcrumb tracking entity page traversal.
 * Shows after 2+ entity hops. Max 5 steps.
 */
export function useExplorePath() {
  const [path, setPath] = useState<ExploreStep[]>(() => loadPath());

  const pushEntity = useCallback(
    (type: ExploreStep['type'], id: string, label: string, href: string) => {
      setPath((prev) => {
        // Don't duplicate if already the last step
        if (prev.length > 0 && prev[prev.length - 1].id === id) return prev;

        // If already in path, truncate to that point (backtracking)
        const existingIdx = prev.findIndex((s) => s.type === type && s.id === id);
        if (existingIdx >= 0) {
          const truncated = prev.slice(0, existingIdx + 1);
          savePath(truncated);
          return truncated;
        }

        const next = [...prev, { type, id, label, href }];
        // Enforce max — drop oldest
        if (next.length > MAX_STEPS) next.shift();
        savePath(next);
        return next;
      });
    },
    [],
  );

  const clearPath = useCallback(() => {
    setPath([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const goToStep = useCallback((index: number) => {
    setPath((prev) => {
      const truncated = prev.slice(0, index + 1);
      savePath(truncated);
      return truncated;
    });
  }, []);

  return {
    explorePath: path,
    pushEntity,
    clearPath,
    goToStep,
    /** Only show the path after 2+ entity visits */
    showPath: path.length >= 2,
  };
}
