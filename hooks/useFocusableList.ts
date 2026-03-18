'use client';

import { useEffect, useMemo } from 'react';
import { useFocusStore } from '@/lib/workspace/focus';

/**
 * Connects a list component to the focus management system.
 *
 * When the list mounts, it registers as the active list for J/K navigation.
 * Returns props to spread on each list item for focus tracking + CSS indicators.
 *
 * Usage:
 * ```tsx
 * const { activeIndex, getItemProps } = useFocusableList('drafts-list', drafts.length);
 *
 * {drafts.map((draft, i) => (
 *   <div key={draft.id} {...getItemProps(i)}>
 *     {draft.title}
 *   </div>
 * ))}
 * ```
 */
export function useFocusableList(listId: string, length: number) {
  const activeListId = useFocusStore((s) => s.activeListId);
  const activeIndex = useFocusStore((s) => s.activeIndex);
  const setActiveList = useFocusStore((s) => s.setActiveList);
  const clearActiveList = useFocusStore((s) => s.clearActiveList);

  // Register this list as active on mount
  useEffect(() => {
    setActiveList(listId, length);
    return () => {
      clearActiveList(listId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  // Update length when items change
  useEffect(() => {
    if (activeListId === listId) {
      setActiveList(listId, length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  const isActive = activeListId === listId;
  const currentIndex = isActive ? activeIndex : -1;

  const getItemProps = useMemo(() => {
    return (index: number) => ({
      'data-focus-active': isActive && index === activeIndex ? ('true' as const) : undefined,
      tabIndex: isActive && index === activeIndex ? 0 : -1,
    });
  }, [isActive, activeIndex]);

  return {
    /** The index of the currently focused item, or -1 if this list is not active */
    activeIndex: currentIndex,
    /** Whether this list is the currently active focus target */
    isActive,
    /** Spread on each list item: `<div {...getItemProps(index)} />` */
    getItemProps,
  };
}
