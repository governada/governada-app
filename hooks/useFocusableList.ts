'use client';

import { useEffect, useMemo } from 'react';
import { useFocusStore } from '@/lib/workspace/focus';

/**
 * Connects a list component to the focus management system.
 *
 * When the list mounts, it registers as the active list for J/K navigation.
 * Returns props to spread on the list container and each list item for
 * focus tracking, ARIA attributes, and CSS indicators.
 *
 * Usage:
 * ```tsx
 * const { activeIndex, getListProps, getItemProps } = useFocusableList('drafts-list', drafts.length);
 *
 * <div {...getListProps()}>
 *   {drafts.map((draft, i) => (
 *     <div key={draft.id} {...getItemProps(i)}>
 *       {draft.title}
 *     </div>
 *   ))}
 * </div>
 * ```
 */
export function useFocusableList(listId: string, length: number) {
  const activeListId = useFocusStore((s) => s.activeListId);
  const activeIndex = useFocusStore((s) => s.activeIndex);
  const inputMethod = useFocusStore((s) => s.inputMethod);
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

  const getListProps = useMemo(() => {
    return () => ({
      role: 'listbox' as const,
      'aria-label': listId,
      'aria-activedescendant':
        isActive && activeIndex >= 0 ? `${listId}-item-${activeIndex}` : undefined,
    });
  }, [isActive, activeIndex, listId]);

  const getItemProps = useMemo(() => {
    return (index: number) => ({
      id: `${listId}-item-${index}`,
      role: 'option' as const,
      'aria-selected': isActive && index === activeIndex ? (true as const) : undefined,
      'data-focus-active': isActive && index === activeIndex ? ('true' as const) : undefined,
      'data-focus-method': isActive && index === activeIndex ? (inputMethod as string) : undefined,
      tabIndex: isActive && index === activeIndex ? 0 : -1,
    });
  }, [isActive, activeIndex, inputMethod, listId]);

  return {
    /** The index of the currently focused item, or -1 if this list is not active */
    activeIndex: currentIndex,
    /** Whether this list is the currently active focus target */
    isActive,
    /** Spread on the list container: `<div {...getListProps()} />` */
    getListProps,
    /** Spread on each list item: `<div {...getItemProps(index)} />` */
    getItemProps,
  };
}
