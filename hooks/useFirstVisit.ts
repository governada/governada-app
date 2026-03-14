'use client';

/* eslint-disable react-hooks/set-state-in-effect -- async/external state sync in useEffect is standard React pattern */
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'governada-visited-pages';

function getVisited(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markVisited(pageKey: string) {
  if (typeof window === 'undefined') return;
  try {
    const visited = getVisited();
    visited.add(pageKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]));
  } catch {
    /* localStorage may be full or disabled */
  }
}

/**
 * Tracks whether the user has visited a page before (via localStorage).
 * Returns `isFirstVisit` on mount, then marks the page as visited.
 * The banner can be dismissed early via `dismiss()`.
 */
export function useFirstVisit(pageKey: string) {
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const visited = getVisited();
    if (!visited.has(pageKey)) {
      setIsFirstVisit(true);
      markVisited(pageKey);
    }
  }, [pageKey]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    /** True only on the user's first visit to this page (and not dismissed) */
    showBanner: isFirstVisit && !dismissed,
    dismiss,
  };
}
