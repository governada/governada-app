'use client';

/**
 * SenecaThread -- Floating conversation panel that replaces the IntelligencePanel.
 *
 * Opens from the Orb position (lower-right). Glassmorphic overlay that does NOT
 * push main content. Desktop: floating card. Mobile: full-width bottom sheet.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trash2, Search, Loader2, ArrowRight, Share2, Check, Microscope } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSenecaSearch } from '@/hooks/useSenecaSearch';
import type { SearchResult } from '@/hooks/useSenecaSearch';
import { CompassSigil } from '@/components/governada/CompassSigil';
import { SenecaMatch } from '@/components/governada/panel/SenecaMatch';
import { SenecaResearch } from '@/components/governada/panel/SenecaResearch';
import { SenecaInput } from '@/components/governada/panel/SenecaInput';
import { AIResponse } from '@/components/commandpalette/AIResponse';
import type { ThreadMessage } from '@/stores/senecaThreadStore';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import type { PanelRoute } from '@/hooks/useSenecaThread';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useSegment } from '@/components/providers/SegmentProvider';
import { readAdvisorStream, detectStreamTopic } from '@/lib/intelligence/streamAdvisor';
import { useSenecaMemory } from '@/hooks/useSenecaMemory';
import { cn } from '@/lib/utils';
import posthog from 'posthog-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SenecaThreadProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'idle' | 'conversation' | 'research' | 'matching' | 'search';
  persona: {
    id: string;
    label: string;
    accentColor?: string;
    accentClass?: string;
  };
  panelRoute: PanelRoute;
  entityId?: string;
  pendingQuery?: string;
  messages: ThreadMessage[];
  onStartConversation: (query?: string) => void;
  onStartResearch: (query: string) => void;
  onStartMatch: () => void;
  onReturnToIdle: () => void;
  onAddMessage: (msg: ThreadMessage) => void;
  onUpdateLastAssistant: (content: string) => void;
  onClearConversation: () => void;
  /** For globe bridge on homepage */
  onGlobeCommand?: (cmd: unknown) => void;
  onEntityFocus?: (entityType: string, entityId: string) => void;
  /** Whether user is authenticated (affects what's available) */
  isAuthenticated?: boolean;
}

// ---------------------------------------------------------------------------
// Route -> human-readable label
// ---------------------------------------------------------------------------

const ROUTE_LABELS: Record<PanelRoute, string> = {
  hub: 'Home',
  proposal: 'Proposal',
  drep: 'Representative',
  'proposals-list': 'Proposals',
  'representatives-list': 'Representatives',
  health: 'Network Health',
  treasury: 'Treasury',
  workspace: 'Workspace',
  default: 'Governance',
};

// ---------------------------------------------------------------------------
// Sigil state mapping
// ---------------------------------------------------------------------------

function sigilStateForMode(mode: SenecaThreadProps['mode']) {
  switch (mode) {
    case 'conversation':
      return 'speaking' as const;
    case 'research':
      return 'searching' as const;
    case 'matching':
      return 'thinking' as const;
    case 'search':
      return 'searching' as const;
    default:
      return 'idle' as const;
  }
}

// ---------------------------------------------------------------------------
// Idle briefing messages per route
// ---------------------------------------------------------------------------

const IDLE_BRIEFINGS: Record<PanelRoute, string> = {
  hub: "Cardano governance is happening right now. Representatives are voting on proposals that shape the ecosystem's future. I can help you explore what's at stake — or find who should represent your ADA.",
  proposal:
    "Every proposal carries consequences that outlast the epoch it was written in. I can walk you through what this one means, who's voted, and why it matters.",
  drep: 'This representative has a story written in on-chain votes. I can show you their record, their alignment, and how they compare to others you might consider.',
  'proposals-list':
    "Each proposal below could reshape Cardano's direction. Search by topic to find what matters to you, or let me highlight what needs attention.",
  'representatives-list':
    'These are the people who vote on your behalf. Search by priority — treasury transparency, developer funding, decentralization — to find who aligns with your values.',
  health:
    'Governance health tells the story of how well the system is working. Participation, quorum, voting patterns — the vital signs of decentralized democracy.',
  treasury:
    "The treasury funds Cardano's future. I can break down where the money goes, what's being requested, and the spending patterns that shape the ecosystem.",
  workspace:
    'Your workspace is where proposals come to life. I can help with drafting, constitutional compliance, or understanding what makes a proposal succeed.',
  default:
    "I'm Seneca, your governance companion. I can help you explore Cardano governance, find your representative, or discover what's being decided right now.",
};

// ---------------------------------------------------------------------------
// Quick action chips for idle mode (authenticated)
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string;
  action: 'conversation' | 'research' | 'match';
  query?: string;
}

function getQuickActions(route: PanelRoute): QuickAction[] {
  switch (route) {
    case 'hub':
      return [
        {
          label: 'Summarize today',
          action: 'conversation',
          query: "What's happening in governance today?",
        },
        { label: 'Find my match', action: 'match' },
      ];
    case 'proposal':
      return [
        {
          label: 'Summarize this proposal',
          action: 'conversation',
          query: 'Summarize this proposal for me',
        },
        {
          label: 'Who voted and why?',
          action: 'conversation',
          query: 'Who has voted on this proposal and what were their reasons?',
        },
        { label: 'Research deeper', action: 'research', query: 'Deep analysis of this proposal' },
      ];
    case 'drep':
      return [
        {
          label: 'Voting record',
          action: 'conversation',
          query: "What is this representative's voting record?",
        },
        {
          label: 'Alignment profile',
          action: 'conversation',
          query: "Analyze this representative's governance alignment",
        },
      ];
    case 'proposals-list':
      return [
        {
          label: 'What should I vote on?',
          action: 'conversation',
          query: 'Which proposals need attention right now?',
        },
        { label: 'Find my match', action: 'match' },
      ];
    case 'representatives-list':
      return [
        { label: 'Find my match', action: 'match' },
        {
          label: 'Compare top reps',
          action: 'conversation',
          query: 'Compare the top-rated representatives',
        },
      ];
    default:
      return [
        {
          label: 'How does governance work?',
          action: 'conversation',
          query: 'How does Cardano governance work?',
        },
        { label: 'Find my match', action: 'match' },
      ];
  }
}

// ---------------------------------------------------------------------------
// Guided options for anonymous users
// ---------------------------------------------------------------------------

interface GuidedOption {
  label: string;
  action: 'conversation' | 'match' | 'navigate' | 'search';
  query?: string;
  href?: string;
}

function getAnonOptions(route: PanelRoute): GuidedOption[] {
  switch (route) {
    case 'proposals-list':
      return [
        {
          label: 'Treasury spending proposals',
          action: 'search',
          query: 'treasury spending funding',
        },
        { label: 'Protocol changes', action: 'search', query: 'protocol parameter change update' },
        {
          label: 'Most contested proposals',
          action: 'search',
          query: 'contested controversial debate',
        },
        { label: 'Find my representative', action: 'match' },
      ];
    case 'representatives-list':
      return [
        {
          label: 'Treasury transparency advocates',
          action: 'search',
          query: 'treasury transparency accountability',
        },
        {
          label: 'Developer funding supporters',
          action: 'search',
          query: 'developer tooling funding development',
        },
        {
          label: 'Decentralization advocates',
          action: 'search',
          query: 'decentralization community governance',
        },
        { label: 'Find my match', action: 'match' },
      ];
    case 'hub':
      return [
        {
          label: "What's being decided right now?",
          action: 'search',
          query: 'active proposals being voted on',
        },
        { label: 'Find my representative', action: 'match' },
        {
          label: 'How does governance work?',
          action: 'conversation',
          query: 'How does Cardano governance work?',
        },
      ];
    case 'proposal':
      return [
        { label: 'Similar proposals', action: 'search', query: 'proposals like this one' },
        { label: 'Find my representative', action: 'match' },
      ];
    case 'drep':
      return [
        {
          label: 'Similar representatives',
          action: 'search',
          query: 'representatives with similar values',
        },
        { label: 'Find my match', action: 'match' },
      ];
    default:
      return [
        { label: 'Explore proposals', action: 'search', query: 'governance proposals' },
        { label: 'Find my representative', action: 'match' },
        {
          label: 'How does governance work?',
          action: 'conversation',
          query: 'How does Cardano governance work?',
        },
      ];
  }
}

// ---------------------------------------------------------------------------
// Desktop animation variants
// ---------------------------------------------------------------------------

// Animation variants are inlined in the component for now

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SenecaThread({
  isOpen,
  onClose,
  mode,
  persona,
  panelRoute,
  entityId,
  pendingQuery,
  messages,
  onStartConversation,
  onStartResearch,
  onStartMatch,
  onReturnToIdle,
  onAddMessage,
  onUpdateLastAssistant,
  onClearConversation,
  onGlobeCommand,
  onEntityFocus,
  isAuthenticated,
}: SenecaThreadProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevRouteRef = useRef<PanelRoute>(panelRoute);

  // ── Streaming state ──
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const { segment } = useSegment();
  const daysRemaining = totalDays - day;
  const setPendingQuery = useSenecaThreadStore((s) => s.setPendingQuery);

  // 2B: Conversation memory — fetch prior summaries, save after conversations
  const { memoryContext, saveConversation } = useSenecaMemory(isAuthenticated ?? false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const isStreamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamContentRef = useRef('');
  // Stable ref so the streaming effect doesn't re-run when messages update
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Track route changes for navigation markers in conversation
  const [routeChanged, setRouteChanged] = useState(false);
  // Track previous route for navigation events sent to the advisor
  const prevNavRouteRef = useRef<PanelRoute>(panelRoute);
  useEffect(() => {
    if (prevRouteRef.current !== panelRoute) {
      setRouteChanged(true);
      prevRouteRef.current = panelRoute;
      const t = setTimeout(() => setRouteChanged(false), 100);
      return () => clearTimeout(t);
    }
  }, [panelRoute]);

  // 2C: Navigation-aware context — auto-fire advisor response on route change
  const pendingNavRef = useRef<{
    from: string;
    to: string;
    entityId?: string;
  } | null>(null);
  useEffect(() => {
    if (
      mode !== 'conversation' ||
      isStreamingRef.current ||
      messages.length === 0 ||
      prevNavRouteRef.current === panelRoute
    )
      return;

    const fromRoute = prevNavRouteRef.current;
    prevNavRouteRef.current = panelRoute;

    // Debounce rapid navigation — only fire if user settles for 600ms
    const timer = setTimeout(() => {
      if (isStreamingRef.current) return; // streaming started between debounce
      pendingNavRef.current = {
        from: ROUTE_LABELS[fromRoute],
        to: ROUTE_LABELS[panelRoute],
        entityId,
      };
      posthog.capture('seneca_navigation_context', {
        from: ROUTE_LABELS[fromRoute],
        to: ROUTE_LABELS[panelRoute],
        has_entity: !!entityId,
      });
      // Trigger a synthetic navigation query — the streaming effect picks it up
      setPendingQuery(`[nav:${panelRoute}]`);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelRoute]);

  // ── Streaming effect: pendingQuery → AI response ──
  useEffect(() => {
    if (mode !== 'conversation' || !pendingQuery || isStreamingRef.current) return;

    const query = pendingQuery;
    setPendingQuery(undefined); // consume immediately — prevent double-fire
    isStreamingRef.current = true;
    setIsStreaming(true);
    setToolStatus(null);
    streamContentRef.current = '';

    // 2C: Detect navigation-triggered queries (format: [nav:routeName])
    const isNavQuery = /^\[nav:[^\]]+\]$/.test(query);
    const navEvent = isNavQuery ? pendingNavRef.current : null;
    if (isNavQuery) pendingNavRef.current = null; // consume

    // Snapshot history before adding new messages
    const historyMessages = messagesRef.current
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    if (isNavQuery && navEvent) {
      // For navigation events, send a synthetic user message that the AI understands
      // but DON'T show it in the chat — only show the assistant's response
      historyMessages.push({
        role: 'user',
        content: `I just navigated to the ${navEvent.to} page.${navEvent.entityId ? ` Looking at entity: ${navEvent.entityId}.` : ''}`,
      });
    } else {
      historyMessages.push({ role: 'user', content: query });
    }

    if (!isNavQuery) {
      // Normal user query — show the user message bubble
      const userMsg: ThreadMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        ts: Date.now(),
      };
      onAddMessage(userMsg);
    }

    // Always add the assistant placeholder
    const assistantMsg: ThreadMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      ts: Date.now(),
    };
    onAddMessage(assistantMsg);

    const abort = new AbortController();
    abortRef.current = abort;

    // Track which topics have already warmed the globe this conversation turn
    const warmedTopics = new Set<'treasury' | 'participation' | 'delegation' | 'proposals'>();

    readAdvisorStream(
      historyMessages,
      {
        epoch,
        daysRemaining,
        activeProposalCount: activeProposalCount ?? 0,
        segment,
        pageContext: panelRoute,
        entityId,
        persona: persona.id as 'navigator' | 'analyst' | 'partner' | 'guide',
        conversationMemory: memoryContext,
        ...(navEvent ? { navigationEvent: navEvent } : {}),
      },
      (delta) => {
        streamContentRef.current += delta;
        setToolStatus(null); // clear tool status once text starts flowing
        onUpdateLastAssistant(streamContentRef.current);

        // 3A: Topic-aware globe warming — detect governance topics in streaming text
        // and subtly warm corresponding nodes on the globe
        const topic = detectStreamTopic(delta, warmedTopics);
        if (topic && typeof window !== 'undefined') {
          warmedTopics.add(topic);
          window.dispatchEvent(
            new CustomEvent('senecaGlobeCommand', {
              detail: { type: 'warmTopic', topic },
            }),
          );
        }
      },
      (error) => {
        onUpdateLastAssistant(`_Error: ${error}. Please try again._`);
        isStreamingRef.current = false;
        setIsStreaming(false);
      },
      () => {
        isStreamingRef.current = false;
        setIsStreaming(false);
        // 2B: Save conversation summary for memory continuity
        const conversationMessages = messagesRef.current
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        saveConversation(conversationMessages);
        // 3A: Clear globe highlights when streaming completes so the globe
        // returns to its neutral state after the choreography sequence
        if (warmedTopics.size > 0 && typeof window !== 'undefined') {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('senecaGlobeCommand', { detail: { type: 'clear' } }),
            );
          }, 2000); // Brief delay so the final warming is visible
        }
      },
      abort.signal,
      // 1B: Globe commands — dispatch via CustomEvent so globe receives them
      (cmd) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('senecaGlobeCommand', { detail: cmd }));
        }
        onGlobeCommand?.(cmd);
      },
      // 1F: Parameterized action handlers
      (actionPayload) => {
        const colonIdx = actionPayload.indexOf(':');
        const actionType = colonIdx > 0 ? actionPayload.slice(0, colonIdx) : actionPayload;
        const payload = colonIdx > 0 ? actionPayload.slice(colonIdx + 1) : '';
        switch (actionType) {
          case 'startMatch':
            abort.abort();
            isStreamingRef.current = false;
            setIsStreaming(false);
            onStartMatch();
            break;
          case 'navigate':
            if (payload) router.push(payload);
            break;
          case 'research':
            if (payload) onStartResearch(payload);
            break;
        }
      },
      // 1C: Tool status display
      (status) => {
        setToolStatus(status);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pendingQuery]);

  // Abort stream when leaving conversation mode
  useEffect(() => {
    if (mode !== 'conversation') {
      abortRef.current?.abort();
      isStreamingRef.current = false;
      setIsStreaming(false);
      setToolStatus(null);
    }
  }, [mode]);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 1D: Entity focus — navigate to entity page (or use prop callback if provided)
  const handleEntityFocus = useCallback(
    (entityType: string, id: string) => {
      if (onEntityFocus) {
        onEntityFocus(entityType, id);
        return;
      }
      if (entityType === 'drep') {
        router.push(`/drep/${encodeURIComponent(id)}`);
      } else if (entityType === 'proposal') {
        router.push(`/proposal/${id}`);
      }
    },
    [onEntityFocus, router],
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, mode]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Quick action handler
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      switch (action.action) {
        case 'conversation':
          onStartConversation(action.query);
          break;
        case 'research':
          if (action.query) onStartResearch(action.query);
          break;
        case 'match':
          onStartMatch();
          break;
      }
    },
    [onStartConversation, onStartResearch, onStartMatch],
  );

  // Semantic search
  const senecaSearch = useSenecaSearch();

  // Anon option handler
  const handleAnonOption = useCallback(
    (option: GuidedOption) => {
      switch (option.action) {
        case 'conversation':
          onStartConversation(option.query);
          break;
        case 'match':
          onStartMatch();
          break;
        case 'navigate':
          if (option.href) {
            router.push(option.href);
            onClose();
          }
          break;
        case 'search':
          if (option.query) {
            senecaSearch.search(option.query);
          }
          break;
      }
    },
    [onStartConversation, onStartMatch, onClose, router, senecaSearch],
  );

  // Determine persona label to show in header
  const personaLabel = useMemo(() => {
    if (persona.id === 'navigator' || persona.id === 'guide') return null;
    return persona.label;
  }, [persona.id, persona.label]);

  const quickActions = useMemo(() => getQuickActions(panelRoute), [panelRoute]);
  const anonOptions = useMemo(() => getAnonOptions(panelRoute), [panelRoute]);

  const sigilState = sigilStateForMode(mode);

  // Insert navigation marker into messages for display
  const messagesWithMarkers = useMemo(() => {
    if (mode !== 'conversation' || !routeChanged) return messages;
    // If route changed, we don't mutate messages — the marker is rendered separately below
    return messages;
  }, [messages, mode, routeChanged]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="seneca-thread-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={onClose}
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            key="seneca-thread-panel"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              // Shared
              'fixed z-40 flex flex-col overflow-hidden',
              'bg-black/75 backdrop-blur-2xl border border-white/[0.08]',
              'shadow-2xl shadow-black/40',
              // Desktop: floating card
              'lg:bottom-20 lg:right-6 lg:w-[380px] lg:max-h-[70vh] lg:rounded-2xl',
              // Mobile: bottom sheet
              'max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:h-[90vh] max-lg:rounded-t-2xl',
            )}
            role="dialog"
            aria-label="Seneca conversation"
            aria-modal="true"
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] shrink-0">
              <CompassSigil state={sigilState} size={18} accentColor={persona.accentColor} />
              <span className="text-sm font-semibold text-foreground/90">Seneca</span>
              {personaLabel && (
                <span className="text-xs text-muted-foreground/60">&middot; {personaLabel}</span>
              )}

              <div className="flex-1" />

              {/* Clear conversation */}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onClearConversation}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  )}
                  aria-label="Clear conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-label="Close Seneca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Page context indicator ── */}
            <div className="px-3 py-1.5 border-b border-white/[0.04] shrink-0">
              <p className="text-[10px] text-muted-foreground/50 tracking-wide">
                Now viewing:{' '}
                <span className="text-muted-foreground/70 font-medium">
                  {ROUTE_LABELS[panelRoute]}
                </span>
              </p>
            </div>

            {/* ── Content area ── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent"
            >
              {/* Idle mode */}
              {mode === 'idle' && (
                <IdleContent
                  panelRoute={panelRoute}
                  isAuthenticated={isAuthenticated}
                  quickActions={quickActions}
                  anonOptions={anonOptions}
                  onQuickAction={handleQuickAction}
                  onAnonOption={handleAnonOption}
                  accentColor={persona.accentColor}
                />
              )}

              {/* Conversation mode */}
              {mode === 'conversation' && (
                <ConversationContent
                  messages={messagesWithMarkers}
                  onEntityFocus={handleEntityFocus}
                  routeChanged={routeChanged}
                  routeLabel={ROUTE_LABELS[panelRoute]}
                  accentColor={persona.accentColor}
                  isStreaming={isStreaming}
                  toolStatus={toolStatus}
                  personaId={persona.id}
                  onStartResearch={onStartResearch}
                />
              )}

              {/* Research mode */}
              {mode === 'research' && pendingQuery && (
                <SenecaResearch question={pendingQuery} onBack={onReturnToIdle} />
              )}

              {/* Matching mode */}
              {mode === 'matching' && (
                <SenecaMatch
                  onBack={onReturnToIdle}
                  onGlobeCommand={
                    onGlobeCommand as
                      | ((cmd: import('@/hooks/useSenecaGlobeBridge').GlobeCommand) => void)
                      | undefined
                  }
                />
              )}

              {/* Search results (shown in idle mode when search has results) */}
              {mode === 'idle' && senecaSearch.hasSearched && (
                <SearchResultsContent
                  results={senecaSearch.results}
                  query={senecaSearch.query}
                  isSearching={senecaSearch.isSearching}
                  error={senecaSearch.error}
                  onClear={senecaSearch.clearSearch}
                  accentColor={persona.accentColor}
                />
              )}
            </div>

            {/* ── Input area ── */}
            {(mode === 'idle' || mode === 'conversation') && (
              <div className="shrink-0 border-t border-white/[0.06]">
                {isAuthenticated ? (
                  /* Authenticated: full AI conversation input */
                  <SenecaInput
                    panelRoute={panelRoute}
                    onSubmit={(query) => onStartConversation(query)}
                    disabled={isStreaming}
                  />
                ) : (
                  /* Anonymous: semantic search input (no AI API cost) */
                  <SearchInput
                    onSearch={(q) => senecaSearch.search(q)}
                    isSearching={senecaSearch.isSearching}
                    panelRoute={panelRoute}
                  />
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Idle content
// ---------------------------------------------------------------------------

function IdleContent({
  panelRoute,
  isAuthenticated,
  quickActions,
  anonOptions,
  onQuickAction,
  onAnonOption,
  accentColor,
}: {
  panelRoute: PanelRoute;
  isAuthenticated?: boolean;
  quickActions: QuickAction[];
  anonOptions: GuidedOption[];
  onQuickAction: (action: QuickAction) => void;
  onAnonOption: (option: GuidedOption) => void;
  accentColor?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="px-3 py-3 space-y-3">
      {/* Narrated briefing */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex gap-2 items-start"
      >
        <div className="shrink-0 mt-0.5">
          <CompassSigil state="idle" size={14} accentColor={accentColor} />
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{IDLE_BRIEFINGS[panelRoute]}</p>
      </motion.div>

      {/* Quick actions (authenticated) or guided options (anonymous) */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.2 }}
        className="flex flex-wrap gap-1.5"
      >
        {isAuthenticated
          ? quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onQuickAction(action)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium',
                  'border border-white/[0.08] bg-white/[0.04]',
                  'hover:bg-white/[0.08] hover:border-white/[0.12]',
                  'text-foreground/70 hover:text-foreground/90',
                  'transition-colors min-h-[32px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                {action.label}
              </button>
            ))
          : anonOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onAnonOption(option)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium',
                  'border border-white/[0.08] bg-white/[0.04]',
                  'hover:bg-white/[0.08] hover:border-white/[0.12]',
                  'text-foreground/70 hover:text-foreground/90',
                  'transition-colors min-h-[32px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                {option.label}
              </button>
            ))}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation content
// ---------------------------------------------------------------------------

/** Heuristic: show "Go deeper" if response is substantive and query implies analysis. */
const DEEP_QUERY_RE = /\b(compare|analyz|research|explain|how|why|detail|assess)\b/i;
function shouldShowGoDeeper(content: string, query: string): boolean {
  return content.length >= 200 && !!query && DEEP_QUERY_RE.test(query);
}

function ConversationContent({
  messages,
  onEntityFocus,
  routeChanged,
  routeLabel,
  accentColor,
  isStreaming,
  toolStatus,
  personaId,
  onStartResearch,
}: {
  messages: ThreadMessage[];
  onEntityFocus?: (entityType: string, entityId: string) => void;
  routeChanged: boolean;
  routeLabel: string;
  accentColor?: string;
  isStreaming: boolean;
  toolStatus: string | null;
  personaId?: string;
  onStartResearch?: (query: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Navigation marker when route changes during conversation */}
      {routeChanged && messages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10px] text-muted-foreground/40 shrink-0">
            Now viewing: {routeLabel}
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
      )}

      {messages.map((msg, idx) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end px-3 py-2">
              <div
                className={cn(
                  'max-w-[85%] px-3 py-1.5 rounded-2xl rounded-br-sm',
                  'bg-primary/15 text-foreground/90 text-sm leading-relaxed',
                )}
              >
                {msg.content}
              </div>
            </div>
          );
        }

        // Assistant message — last one may be actively streaming
        const isLastMsg = idx === messages.length - 1;
        const msgIsStreaming = isLastMsg && isStreaming;
        // Show share button on completed assistant messages with substantial content
        const showShare = !msgIsStreaming && msg.content.length > 80;
        // "Go deeper" — only on last completed assistant message
        const precedingUser = idx > 0 ? messages[idx - 1] : undefined;
        const userQuery = precedingUser?.role === 'user' ? precedingUser.content : '';
        const showGoDeeper =
          isLastMsg &&
          !isStreaming &&
          onStartResearch &&
          shouldShowGoDeeper(msg.content, userQuery);

        return (
          <div key={msg.id}>
            <div className="group flex gap-2 items-start px-3 py-2">
              <div className="shrink-0 mt-1">
                <CompassSigil
                  state={msgIsStreaming ? 'thinking' : 'idle'}
                  size={14}
                  accentColor={accentColor}
                />
              </div>
              <div className="flex-1 min-w-0">
                {/* 1C: Tool status — shown when tool executes before text arrives */}
                {msgIsStreaming && toolStatus && msg.content === '' ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-muted-foreground/50 animate-pulse"
                  >
                    {toolStatus}
                  </motion.span>
                ) : (
                  <AIResponse
                    content={msg.content}
                    isStreaming={msgIsStreaming}
                    onEntityFocus={onEntityFocus}
                  />
                )}

                {/* 3C: Share this insight */}
                {showShare && (
                  <ShareInsightButton content={msg.content} personaId={personaId} msgId={msg.id} />
                )}
              </div>
            </div>
            {showGoDeeper && (
              <div className="px-3 pb-2 pl-8">
                <button
                  type="button"
                  onClick={() => onStartResearch!(userQuery)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md',
                    'text-[11px] font-medium text-primary/80',
                    'bg-primary/5 hover:bg-primary/10 border border-primary/15 hover:border-primary/25',
                    'transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  )}
                >
                  <Microscope className="h-3 w-3" />
                  Go deeper
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3C: Share insight button — generates shareable link with OG card
// ---------------------------------------------------------------------------

function ShareInsightButton({
  content,
  personaId,
  msgId,
}: {
  content: string;
  personaId?: string;
  msgId: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    // Extract the first meaningful sentence as the quote for the OG card
    const quote = content
      .replace(/\*\*/g, '') // strip markdown bold
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip links
      .slice(0, 280);

    // Detect topic from content
    let topic = 'Governance Insight';
    if (/treasury|withdrawal|funding|budget/i.test(content)) topic = 'Treasury Analysis';
    else if (/proposal|governance action/i.test(content)) topic = 'Proposal Analysis';
    else if (/drep|representative|delegation/i.test(content)) topic = 'Representative Analysis';
    else if (/health|participation|quorum/i.test(content)) topic = 'Governance Health';

    // Build share URL for X/Twitter
    const shareText = `${quote.slice(0, 200)}${quote.length > 200 ? '...' : ''}\n\nvia @governada`;
    const shareUrl = `${window.location.origin}/pulse`;
    const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    // Try native share API first (mobile), fallback to copy + open X
    if (navigator.share) {
      void navigator.share({ title: 'Seneca Insight', text: quote, url: shareUrl });
    } else {
      void navigator.clipboard?.writeText(`${quote}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    }

    // PostHog analytics
    import('posthog-js')
      .then((mod) => mod.default.capture('seneca_insight_shared', { topic, persona: personaId }))
      .catch(() => {});
  }, [content, personaId, msgId]);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      onClick={handleShare}
      className={cn(
        'mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]',
        'text-muted-foreground/30 hover:text-muted-foreground/60',
        'hover:bg-white/[0.04] transition-colors',
        'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
      )}
      aria-label="Share this insight"
    >
      {copied ? (
        <>
          <Check className="h-2.5 w-2.5" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Share2 className="h-2.5 w-2.5" />
          <span>Share insight</span>
        </>
      )}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Search input for anonymous users
// ---------------------------------------------------------------------------

const SEARCH_PLACEHOLDERS: Record<PanelRoute, string> = {
  hub: 'Search proposals, representatives, pools...',
  proposal: 'Search for similar proposals...',
  drep: 'Search for similar representatives...',
  'proposals-list': 'Search proposals by topic...',
  'representatives-list': 'Search representatives by priority...',
  health: 'Search governance topics...',
  treasury: 'Search treasury proposals...',
  workspace: 'Search governance entities...',
  default: 'Search proposals, representatives, pools...',
};

function SearchInput({
  onSearch,
  isSearching,
  panelRoute,
}: {
  onSearch: (query: string) => void;
  isSearching: boolean;
  panelRoute: PanelRoute;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (value.trim().length >= 2) {
        onSearch(value.trim());
      }
    },
    [value, onSearch],
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2.5">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={SEARCH_PLACEHOLDERS[panelRoute]}
          className={cn(
            'w-full pl-8 pr-3 py-2 rounded-xl text-sm',
            'bg-white/[0.04] border border-white/[0.08]',
            'text-foreground/90 placeholder:text-muted-foreground/40',
            'focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30',
            'transition-colors',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              inputRef.current?.blur();
            }
          }}
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Search results display
// ---------------------------------------------------------------------------

function SearchResultsContent({
  results,
  query,
  isSearching,
  error,
  onClear,
  accentColor,
}: {
  results: SearchResult[];
  query: string;
  isSearching: boolean;
  error: string | null;
  onClear: () => void;
  accentColor?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Search context header */}
      <div className="flex items-center gap-2">
        <CompassSigil
          state={isSearching ? 'searching' : 'idle'}
          size={14}
          accentColor={accentColor}
        />
        <p className="text-xs text-muted-foreground/70 flex-1">
          {isSearching ? (
            'Searching across governance...'
          ) : error ? (
            <span className="text-red-400/70">{error}</span>
          ) : results.length === 0 ? (
            <>No results found for &ldquo;{query}&rdquo;. Try different terms.</>
          ) : (
            <>
              Found {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}
              &rdquo;
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Seneca narration of results */}
      {results.length > 0 && !isSearching && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 items-start"
        >
          <p className="text-sm text-foreground/70 leading-relaxed">
            {getSearchNarration(results, query)}
          </p>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {isSearching && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2"
            >
              <div className="h-3 bg-white/[0.06] rounded w-3/4" />
              <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Result cards */}
      {!isSearching &&
        results.map((result, i) => (
          <motion.div
            key={`${result.entityType}-${result.entityId}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={result.href}
              className={cn(
                'block rounded-xl p-3 space-y-1',
                'bg-white/[0.03] border border-white/[0.06]',
                'hover:bg-white/[0.06] hover:border-white/[0.10]',
                'transition-colors group',
              )}
            >
              {/* Type badge + similarity */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    result.entityType === 'proposal'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-violet-500/10 text-violet-400',
                  )}
                >
                  {result.entityType === 'proposal' ? 'Proposal' : 'Representative'}
                </span>
                {result.status && (
                  <span className="text-[10px] text-muted-foreground/50">{result.status}</span>
                )}
                <span className="text-[10px] text-muted-foreground/30 ml-auto">
                  {Math.round(result.similarity * 100)}% match
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-foreground/85 group-hover:text-foreground/95 line-clamp-2 transition-colors">
                {result.title}
              </p>

              {/* Subtitle */}
              {result.subtitle && (
                <p className="text-xs text-muted-foreground/50 line-clamp-1">{result.subtitle}</p>
              )}

              {/* Arrow hint */}
              <div className="flex items-center gap-1 text-primary/50 group-hover:text-primary/70 transition-colors">
                <span className="text-[10px]">View details</span>
                <ArrowRight className="h-2.5 w-2.5" />
              </div>
            </Link>
          </motion.div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Narration helper — Seneca contextualizes the search results
// ---------------------------------------------------------------------------

function getSearchNarration(results: SearchResult[], query: string): string {
  const proposalCount = results.filter((r) => r.entityType === 'proposal').length;
  const drepCount = results.filter((r) => r.entityType === 'drep_profile').length;

  if (proposalCount > 0 && drepCount > 0) {
    return `I found ${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} and ${drepCount} representative${drepCount !== 1 ? 's' : ''} related to "${query}." Here's what stands out:`;
  }
  if (proposalCount > 0) {
    return `Here are ${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} related to "${query}." Each one could shape Cardano's direction:`;
  }
  if (drepCount > 0) {
    return `I found ${drepCount} representative${drepCount !== 1 ? 's' : ''} whose priorities align with "${query}":`;
  }
  return `Here's what I found for "${query}":`;
}
