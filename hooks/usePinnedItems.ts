'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'governada_pinned_items';
const MAX_PINS = 5;

export type PinnedEntityType = 'drep' | 'proposal' | 'pool' | 'cc';

export interface PinnedItem {
  type: PinnedEntityType;
  id: string;
  label: string;
}

function loadPins(): PinnedItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePins(items: PinnedItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * Manage pinned items in localStorage with React state sync.
 * Max 5 items — oldest removed when adding a 6th.
 */
export function usePinnedItems() {
  const [items, setItems] = useState<PinnedItem[]>(() => {
    // SSR-safe: return empty during SSR, hydrate from localStorage on client
    if (typeof window === 'undefined') return [];
    return loadPins();
  });

  const pin = useCallback((type: PinnedEntityType, id: string, label: string) => {
    setItems((prev) => {
      // Don't duplicate
      if (prev.some((p) => p.type === type && p.id === id)) return prev;
      const next = [...prev, { type, id, label }];
      // Enforce max — drop oldest
      if (next.length > MAX_PINS) next.shift();
      savePins(next);
      return next;
    });
  }, []);

  const unpin = useCallback((type: PinnedEntityType, id: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => !(p.type === type && p.id === id));
      savePins(next);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (type: PinnedEntityType, id: string) => items.some((p) => p.type === type && p.id === id),
    [items],
  );

  return { pinnedItems: items, pin, unpin, isPinned };
}
