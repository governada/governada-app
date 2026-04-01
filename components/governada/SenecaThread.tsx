'use client';

/**
 * SenecaThread -- Floating conversation panel that replaces the IntelligencePanel.
 *
 * Opens from the Orb position (lower-right). Glassmorphic overlay that does NOT
 * push main content. Desktop: floating card. Mobile: full-width bottom sheet.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSenecaSearch } from '@/hooks/useSenecaSearch';
import { CompassSigil } from '@/components/governada/CompassSigil';
import { SenecaMatch } from '@/components/governada/panel/SenecaMatch';
import { SenecaResearch } from '@/components/governada/panel/SenecaResearch';
import { SenecaInput } from '@/components/governada/panel/SenecaInput';
import type { ThreadMessage } from '@/stores/senecaThreadStore';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import type { PanelRoute, World } from '@/hooks/useSenecaThread';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  readAdvisorStream,
  detectStreamTopic,
  type WarmTopic,
} from '@/lib/intelligence/streamAdvisor';
import { useSenecaMemory } from '@/hooks/useSenecaMemory';
import { cn } from '@/lib/utils';
import posthog from 'posthog-js';
import { dispatchGlobeCommand } from '@/lib/globe/globeCommandBus';
import {
  ROUTE_LABELS,
  getQuickActions,
  getAnonOptions,
  getDiscoveryChips,
  sigilStateForMode,
  IdleContent,
} from '@/components/governada/panel/SenecaIdle';
import type { QuickAction, GuidedOption } from '@/components/governada/panel/SenecaIdle';
import { useFeatureFlag } from '@/components/FeatureGate';
import { ConversationContent } from '@/components/governada/panel/SenecaMessages';
import { SearchInput, SearchResultsContent } from '@/components/governada/panel/SenecaSearchPanel';

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
  world?: World;
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

// Constants and sub-components extracted to:
// - components/governada/panel/SenecaIdle.tsx (ROUTE_LABELS, getQuickActions, getAnonOptions, sigilStateForMode, IdleContent)
// - components/governada/panel/SenecaMessages.tsx (ConversationContent, ShareInsightButton)
// - components/governada/panel/SenecaSearchPanel.tsx (SearchInput, SearchResultsContent)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SenecaThread({
  isOpen,
  onClose,
  mode,
  persona,
  panelRoute,
  world,
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
    const warmedTopics = new Set<WarmTopic>();

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
        world,
        ...(navEvent ? { navigationEvent: navEvent } : {}),
      },
      (delta) => {
        streamContentRef.current += delta;
        setToolStatus(null); // clear tool status once text starts flowing
        onUpdateLastAssistant(streamContentRef.current);

        // 3A: Topic-aware globe warming — detect governance topics in streaming text
        // and subtly warm corresponding nodes on the globe
        const topic = detectStreamTopic(delta, warmedTopics);
        if (topic) {
          warmedTopics.add(topic);
          dispatchGlobeCommand({ type: 'warmTopic', topic });
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
        if (warmedTopics.size > 0) {
          setTimeout(() => {
            dispatchGlobeCommand({ type: 'clear' });
          }, 2000); // Brief delay so the final warming is visible
        }
      },
      abort.signal,
      // 1B: Globe commands — dispatch via centralized command bus
      (cmd) => {
        dispatchGlobeCommand(cmd as import('@/lib/globe/types').GlobeCommand);
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
      // Dispatch globe hint immediately so the globe reacts while Seneca processes
      if (action.globeHint) {
        dispatchGlobeCommand({ type: 'warmTopic', topic: action.globeHint });
      }
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
        case 'navigate':
          if (action.href) {
            posthog.capture('globe_workspace_pill_clicked', { destination: action.href });
            // Warm the globe with proposals topic before navigating
            dispatchGlobeCommand({ type: 'warmTopic', topic: 'proposals' });
            router.push(action.href);
            onClose();
          }
          break;
      }
    },
    [onStartConversation, onStartResearch, onStartMatch, router, onClose],
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

  const discoveryFlag = useFeatureFlag('seneca_globe_discovery');
  const useDiscoveryChips = discoveryFlag === true && world === 'home';

  const quickActions = useMemo(
    () => (useDiscoveryChips ? getDiscoveryChips(true) : getQuickActions(panelRoute)),
    [panelRoute, useDiscoveryChips],
  );
  const anonOptions = useMemo(
    () =>
      useDiscoveryChips
        ? getDiscoveryChips(false).map((c) => ({
            label: c.label,
            action: c.action === 'match' ? ('match' as const) : ('conversation' as const),
            query: c.query,
          }))
        : getAnonOptions(panelRoute),
    [panelRoute, useDiscoveryChips],
  );

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
                  onStartConversation={(query) => {
                    onReturnToIdle();
                    // Brief delay to let mode transition settle before starting conversation
                    setTimeout(() => onStartConversation(query), 100);
                  }}
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

// Sub-components extracted to panel/SenecaIdle.tsx, panel/SenecaMessages.tsx, panel/SenecaSearchPanel.tsx
