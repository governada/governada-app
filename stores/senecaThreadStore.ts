'use client';

/**
 * senecaThreadStore — Session-scoped Zustand store for Seneca conversation persistence.
 *
 * Maintains conversation messages across page navigation within a browser session.
 *
 * Key behaviors:
 * - Messages persist across route changes via sessionStorage
 * - Navigation markers injected when the user moves between pages
 * - Capped at 50 messages; oldest dropped (preserving recent navigation markers)
 * - clearConversation wipes all messages and resets to idle
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdvisorMessage } from '@/lib/intelligence/streamAdvisor';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 50;
const KEEP_NAV_PAGES = 5;
const STORAGE_KEY = 'governada_seneca_thread';

// ---------------------------------------------------------------------------
// Extended message type (adds system/navigation markers)
// ---------------------------------------------------------------------------

export interface ThreadMessage extends Omit<AdvisorMessage, 'role'> {
  /** Navigation markers use role 'system' to denote page transitions. */
  role: 'user' | 'assistant' | 'system';
  /** Timestamp for ordering / pruning. */
  ts?: number;
  /** If role === 'system', the page slug this marker represents. */
  page?: string;
}

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

export type SenecaMode = 'idle' | 'conversation' | 'research' | 'matching';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface SenecaThreadState {
  messages: ThreadMessage[];
  isOpen: boolean;
  mode: SenecaMode;
  pendingQuery: string | undefined;
  currentPage: string;
  visitedPages: string[];
}

export interface SenecaThreadActions {
  addMessage: (msg: ThreadMessage) => void;
  updateLastAssistant: (content: string) => void;
  setOpen: (open: boolean) => void;
  setMode: (mode: SenecaMode) => void;
  setPendingQuery: (query: string | undefined) => void;
  navigateTo: (page: string) => void;
  clearConversation: () => void;
  startConversation: (query?: string) => void;
  startResearch: (query: string) => void;
  startMatch: () => void;
  returnToIdle: () => void;
}

// ---------------------------------------------------------------------------
// Pruning helper
// ---------------------------------------------------------------------------

/**
 * Trim messages to MAX_MESSAGES while preserving system/navigation markers
 * from the most recent KEEP_NAV_PAGES distinct pages.
 */
function pruneMessages(messages: ThreadMessage[]): ThreadMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages;

  // Collect the last N unique page slugs from navigation markers
  const recentPages = new Set<string>();
  for (let i = messages.length - 1; i >= 0 && recentPages.size < KEEP_NAV_PAGES; i--) {
    const m = messages[i];
    if (m.role === 'system' && m.page) {
      recentPages.add(m.page);
    }
  }

  // Split into "protected" (recent nav markers) and "droppable"
  const protectedIndices = new Set<number>();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'system' && m.page && recentPages.has(m.page)) {
      protectedIndices.add(i);
    }
  }

  // Drop oldest non-protected messages until within cap
  const result: ThreadMessage[] = [];
  let dropCount = messages.length - MAX_MESSAGES;

  for (let i = 0; i < messages.length; i++) {
    if (dropCount > 0 && !protectedIndices.has(i)) {
      dropCount--;
      continue;
    }
    result.push(messages[i]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSenecaThreadStore = create<SenecaThreadState & SenecaThreadActions>()(
  persist(
    (set, get) => ({
      // ----- Initial state -----
      messages: [],
      isOpen: false,
      mode: 'idle' as SenecaMode,
      pendingQuery: undefined,
      currentPage: '',
      visitedPages: [],

      // ----- Actions -----

      addMessage: (msg) =>
        set((s) => ({
          messages: pruneMessages([...s.messages, { ...msg, ts: msg.ts ?? Date.now() }]),
        })),

      updateLastAssistant: (content) =>
        set((s) => {
          const msgs = [...s.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], content };
              break;
            }
          }
          return { messages: msgs };
        }),

      setOpen: (open) => set({ isOpen: open }),

      setMode: (mode) => set({ mode }),

      setPendingQuery: (query) => set({ pendingQuery: query }),

      navigateTo: (page) => {
        const s = get();
        if (page === s.currentPage) return; // no-op for same page

        const navMessage: ThreadMessage = {
          id: `nav-${Date.now()}`,
          role: 'system',
          content: `--- Now viewing: ${page} ---`,
          ts: Date.now(),
          page,
        };

        const visited = s.visitedPages.includes(page) ? s.visitedPages : [...s.visitedPages, page];

        // Only add nav marker if there are existing messages (don't pollute empty threads)
        const messages =
          s.messages.length > 0 ? pruneMessages([...s.messages, navMessage]) : s.messages;

        set({ currentPage: page, visitedPages: visited, messages });
      },

      clearConversation: () =>
        set({
          messages: [],
          mode: 'idle',
          pendingQuery: undefined,
          visitedPages: [],
        }),

      startConversation: (query) => {
        const s = get();
        set({
          mode: 'conversation',
          pendingQuery: query,
          isOpen: true,
        });
        // If panel was closed, ensure we're now open
        if (!s.isOpen) {
          set({ isOpen: true });
        }
      },

      startResearch: (query) => {
        set({
          mode: 'research',
          pendingQuery: query,
          isOpen: true,
        });
      },

      startMatch: () => {
        set({
          mode: 'matching',
          pendingQuery: undefined,
          isOpen: true,
        });
      },

      returnToIdle: () =>
        set({
          mode: 'idle',
          pendingQuery: undefined,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        // Guard for SSR — sessionStorage is only available in the browser
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return sessionStorage;
      }),
      // Only persist conversation-relevant state, not transient UI state
      partialize: (s) => ({
        messages: s.messages,
        isOpen: s.isOpen,
        mode: s.mode,
        pendingQuery: s.pendingQuery,
        currentPage: s.currentPage,
        visitedPages: s.visitedPages,
      }),
    },
  ),
);
