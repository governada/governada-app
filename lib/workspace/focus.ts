'use client';

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FocusState {
  /** Stack of CSS selectors for push/pop focus restoration */
  focusStack: string[];

  /** Currently active list for J/K navigation */
  activeListId: string | null;
  /** Number of items in the active list */
  activeListLength: number;
  /** Currently focused index within the active list */
  activeIndex: number;
}

interface FocusActions {
  /**
   * Save the currently focused element to the stack.
   * Used before opening modals/panels so focus can be restored on close.
   */
  pushFocus: () => void;

  /**
   * Restore focus to the last element saved via pushFocus.
   */
  popFocus: () => void;

  /**
   * Declare a list as the active focus target for J/K navigation.
   * Only one list can be active at a time.
   */
  setActiveList: (id: string, length: number) => void;

  /**
   * Clear the active list (e.g. when the list component unmounts).
   * Only clears if the given id matches the current active list.
   */
  clearActiveList: (id: string) => void;

  /**
   * Set the active index directly.
   */
  setActiveIndex: (index: number) => void;

  /**
   * Move focus up (decrement index, clamped to 0).
   */
  moveUp: () => void;

  /**
   * Move focus down (increment index, clamped to length-1).
   */
  moveDown: () => void;
}

export type FocusStore = FocusState & FocusActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a CSS selector that can re-find the given element. */
function selectorForElement(el: Element): string {
  // Prefer id
  if (el.id) return `#${CSS.escape(el.id)}`;

  // Prefer data-focus-id if set by the component
  const focusId = el.getAttribute('data-focus-id');
  if (focusId) return `[data-focus-id="${CSS.escape(focusId)}"]`;

  // Fallback: tagName + nth-of-type (approximate but better than nothing)
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
    const index = siblings.indexOf(el);
    if (index >= 0) {
      const parentSelector = parent.id ? `#${CSS.escape(parent.id)}` : parent.tagName.toLowerCase();
      return `${parentSelector} > ${tag}:nth-of-type(${index + 1})`;
    }
  }

  return tag;
}

/** Try to focus an element matching a selector. Returns true on success. */
function tryFocus(selector: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.querySelector(selector);
  if (el instanceof HTMLElement) {
    el.focus({ preventScroll: true });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFocusStore = create<FocusStore>()((set, get) => ({
  // --- State ---
  focusStack: [],
  activeListId: null,
  activeListLength: 0,
  activeIndex: 0,

  // --- Actions ---
  pushFocus: () => {
    if (typeof document === 'undefined') return;
    const activeEl = document.activeElement;
    const selector = activeEl ? selectorForElement(activeEl) : '';
    set((s) => ({
      focusStack: [...s.focusStack, selector],
    }));
  },

  popFocus: () => {
    const { focusStack } = get();
    if (focusStack.length === 0) return;
    const selector = focusStack[focusStack.length - 1];
    set({ focusStack: focusStack.slice(0, -1) });
    // Defer focus restoration to next frame to let DOM settle
    if (selector) {
      requestAnimationFrame(() => {
        tryFocus(selector);
      });
    }
  },

  setActiveList: (id, length) => {
    const { activeListId, activeIndex } = get();
    // If same list, just update length (and clamp index if needed)
    if (activeListId === id) {
      const clampedIndex = length > 0 ? Math.min(activeIndex, length - 1) : 0;
      set({ activeListLength: length, activeIndex: clampedIndex });
    } else {
      set({
        activeListId: id,
        activeListLength: length,
        activeIndex: 0,
      });
    }
  },

  clearActiveList: (id) => {
    const { activeListId } = get();
    if (activeListId === id) {
      set({
        activeListId: null,
        activeListLength: 0,
        activeIndex: 0,
      });
    }
  },

  setActiveIndex: (index) => {
    const { activeListLength } = get();
    const clamped = Math.max(0, Math.min(index, activeListLength - 1));
    set({ activeIndex: clamped });
  },

  moveUp: () => {
    const { activeIndex } = get();
    if (activeIndex > 0) {
      set({ activeIndex: activeIndex - 1 });
    }
  },

  moveDown: () => {
    const { activeIndex, activeListLength } = get();
    if (activeIndex < activeListLength - 1) {
      set({ activeIndex: activeIndex + 1 });
    }
  },
}));
