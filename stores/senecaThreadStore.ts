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
import type { AnchoredCardDescriptor } from '@/components/globe/AnchoredCard';
import type { AdvisorMessage } from '@/lib/intelligence/streamAdvisor';
import type { GlobeIntent } from '@/lib/intelligence/advisor';
import type { PrioritizedQueue } from '@/types/cinematic';

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

export interface HomepageCinematicIdentity {
  stakeAddress?: string | null;
  userId?: string | null;
}

export interface HomepageCinematicSnapshot {
  queue: PrioritizedQueue;
  identity: HomepageCinematicIdentity;
}

export interface RegionSuggestionWhisper {
  clusterId: string;
  text: string;
}

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
  /** Intent detected from user query — consumed by GlobeLayout to dispatch globe commands */
  pendingGlobeAction: GlobeIntent | null;
  /** Homepage prioritization-engine output, published by the server shell bridge */
  homepageCinematic: HomepageCinematicSnapshot | null;
  /** Active homepage anchored cards, folded into Seneca on mobile when the sheet is open. */
  homepageAnchoredCards: AnchoredCardDescriptor[];
  /** Soft Layer 2 region suggestion surfaced through the orb whisper */
  regionSuggestionWhisper: RegionSuggestionWhisper | null;
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
  /** Dispatch a globe intent (consumed once by GlobeLayout) */
  dispatchGlobeIntent: (intent: GlobeIntent) => void;
  /** Clear the pending globe action after consumption */
  consumeGlobeAction: () => void;
  setHomepageCinematic: (snapshot: HomepageCinematicSnapshot | null) => void;
  setHomepageAnchoredCards: (cards: AnchoredCardDescriptor[]) => void;
  setRegionSuggestionWhisper: (whisper: RegionSuggestionWhisper | null) => void;
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
// Match intent detection — intercept before hitting the AI API
// ---------------------------------------------------------------------------

const MATCH_INTENT_PATTERNS = [
  /\b(find|match|discover)\b.*\b(drep|representative|delegate|rep)\b/i,
  /\b(drep|representative|delegate|rep)\b.*\b(find|match|discover)\b/i,
  /\bwho\s+should\s+i\s+delegate\b/i,
  /\bwho\s+represents?\s+me\b/i,
  /\bfind\s+(me\s+)?a?\s*match\b/i,
  /\bhelp\s+me\s+(find|choose|pick)\s+(a\s+)?(drep|representative|delegate)\b/i,
  /\bmy\s+(drep|representative)\s+match\b/i,
  /\bquick\s*match\b/i,
  /\bgovernance\s+match\b/i,
  /\bwho\s+aligns?\s+with\s+(me|my\s+values)\b/i,
  /\b(start|begin|run|take)\s+(the\s+)?(match|quiz|matching)\b/i,
];

export function isMatchIntent(query: string): boolean {
  const lower = query.trim().toLowerCase();
  return MATCH_INTENT_PATTERNS.some((p) => p.test(lower));
}

// ---------------------------------------------------------------------------
// Navigation intent detection — obvious page requests bypass AI
// ---------------------------------------------------------------------------

const NAVIGATION_INTENTS: Array<{ pattern: RegExp; path: string }> = [
  { pattern: /\b(governance\s+health|ghi|health\s+(index|pulse|score))\b/i, path: '/pulse' },
  { pattern: /\b(treasury|budget|runway|spending)\b/i, path: '/governance/treasury' },
  { pattern: /\bcommittee\b/i, path: '/governance/committee' },
  { pattern: /\b(leaderboard|top\s+dreps?|rankings?)\b/i, path: '/governance/representatives' },
  { pattern: /\b(my\s+(governance|dashboard|gov))\b/i, path: '/my-gov' },
  { pattern: /\b(voting\s+queue|pending\s+votes|vote\s+now)\b/i, path: '/match/vote' },
  { pattern: /\b(epoch\s+briefing|briefing|recap)\b/i, path: '/governance/briefing' },
  { pattern: /\b(engage|priorities|assembly|assemblies)\b/i, path: '/engage' },
  { pattern: /\b(compare|comparison|side.by.side)\b/i, path: '/compare' },
];

/**
 * Returns a navigation path if the query is an unambiguous page request.
 * Only matches short, direct queries — nuanced questions flow to the AI.
 */
export function getNavigationIntent(query: string): string | null {
  const trimmed = query.trim();
  // Only intercept short queries (< 8 words) that are clearly navigation
  if (trimmed.split(/\s+/).length > 7) return null;

  // Don't intercept if it looks like a question (has a question mark or starts with question word)
  if (trimmed.endsWith('?')) return null;
  if (/^(what|how|why|who|when|where|which|can|could|should|would|is|are|do|does)\b/i.test(trimmed))
    return null;

  const lower = trimmed.toLowerCase();
  for (const { pattern, path } of NAVIGATION_INTENTS) {
    if (pattern.test(lower)) return path;
  }
  return null;
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
      pendingGlobeAction: null,
      homepageCinematic: null,
      homepageAnchoredCards: [],
      regionSuggestionWhisper: null,

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
        // Intercept match intents → built-in Quick Match flow
        if (query && isMatchIntent(query)) {
          set({
            mode: 'matching',
            pendingQuery: undefined,
            isOpen: true,
          });
          return;
        }

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

      dispatchGlobeIntent: (intent) => set({ pendingGlobeAction: intent }),

      consumeGlobeAction: () => set({ pendingGlobeAction: null }),

      setHomepageCinematic: (snapshot) => set({ homepageCinematic: snapshot }),

      setHomepageAnchoredCards: (cards) => set({ homepageAnchoredCards: cards }),

      setRegionSuggestionWhisper: (whisper) => set({ regionSuggestionWhisper: whisper }),
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
      // Exclude pendingGlobeAction — it's consumed immediately by GlobeLayout
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
