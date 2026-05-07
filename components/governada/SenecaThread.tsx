'use client';

/**
 * SenecaThread -- Floating conversation panel that replaces the IntelligencePanel.
 *
 * Opens from the Orb position (lower-right). Glassmorphic overlay that does NOT
 * push main content. Desktop: floating card. Mobile: full-width bottom sheet.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trash2, Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSenecaSearch } from '@/hooks/useSenecaSearch';
import { CompassSigil } from '@/components/governada/CompassSigil';
import { SenecaMatch } from '@/components/governada/panel/SenecaMatch';
import { SenecaResearch } from '@/components/governada/panel/SenecaResearch';
import { SenecaInput } from '@/components/governada/panel/SenecaInput';
import type { ThreadMessage } from '@/stores/senecaThreadStore';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import type { HomepageCinematicSnapshot } from '@/stores/senecaThreadStore';
import type { AnchoredCardDescriptor } from '@/components/globe/AnchoredCard';
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
import { posthog } from '@/lib/posthog';
import { postJson } from '@/lib/api/client';
import { dispatchGlobeCommand } from '@/lib/globe/globeCommandBus';
import { classifyIntent, getMechanicalAnswer } from '@/lib/seneca/intentRouter';
import { getEvergreenFallback } from '@/lib/seneca/evergreenFallbacks';
import { captureSenecaInteraction } from '@/lib/seneca/telemetry';
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
import { SearchResultsContent } from '@/components/governada/panel/SenecaSearchPanel';
import { useViewportClass } from '@/hooks/useViewportClass';
import {
  type MotionStrengthUserOverride,
  useMotionStrengthSetter,
} from '@/lib/motion/motionStrength';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
  homepageCinematic?: HomepageCinematicSnapshot | null;
  homepageAnchoredCards?: AnchoredCardDescriptor[];
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
  homepageCinematic,
  homepageAnchoredCards = [],
}: SenecaThreadProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const viewportClass = useViewportClass();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevRouteRef = useRef<PanelRoute>(panelRoute);
  const wasOpenRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      captureSenecaInteraction({
        kind: 'panel_opened',
        source: 'user',
        mode,
        panel_route: panelRoute,
      });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, mode, panelRoute]);

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
      const intent = classifyIntent(query);
      // Normal user query — show the user message bubble
      const userMsg: ThreadMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        ts: Date.now(),
      };
      onAddMessage(userMsg);
      captureSenecaInteraction({
        kind: 'question_asked',
        intent,
        source: 'seneca_panel',
        panel_route: panelRoute,
      });

      if (intent === 'mechanical') {
        const answer =
          getMechanicalAnswer(query) ??
          'That is a mechanics question. The shortest path is to name the control, then ask again with the word you want defined.';
        const assistantMsg: ThreadMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
          ts: Date.now(),
        };
        onAddMessage(assistantMsg);
        captureSenecaInteraction({
          kind: 'mechanical_question_answered',
          question: query,
          source: 'seneca_panel',
          panel_route: panelRoute,
        });
        return;
      }

      if (intent === 'interrogative') {
        const assistantMsg: ThreadMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            'I can begin narrowing the field. The spatial query path is still being connected, so for now I will hold this as a search intent.',
          ts: Date.now(),
        };
        onAddMessage(assistantMsg);
        captureSenecaInteraction({
          kind: 'interrogative_query_started',
          query,
          source: 'seneca_panel',
          panel_route: panelRoute,
        });
        return;
      }
    }

    isStreamingRef.current = true;
    setIsStreaming(true);

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
        const state = homepageCinematic?.queue.primary.state ?? 'returning_quiet';
        onUpdateLastAssistant(getEvergreenFallback(state));
        captureSenecaInteraction({
          kind: 'observational_observation_emitted',
          source: 'evergreen_fallback',
          state,
          error: String(error),
          panel_route: panelRoute,
        });
        isStreamingRef.current = false;
        setIsStreaming(false);
      },
      () => {
        isStreamingRef.current = false;
        setIsStreaming(false);
        captureSenecaInteraction({
          kind: 'observational_observation_emitted',
          source: 'advisor_stream',
          state: homepageCinematic?.queue.primary.state,
          panel_route: panelRoute,
        });
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
      captureSenecaInteraction({
        kind: 'quick_action_chosen',
        choice: action.href ?? action.query ?? action.label,
        source: 'quick_action',
      });
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

  const handlePrioritizationAction = useCallback(
    async (
      item: NonNullable<HomepageCinematicSnapshot>['queue']['primary'],
      action: 'acknowledge' | 'dismiss',
    ) => {
      try {
        await postJson('/api/governance/acknowledgments', {
          action,
          itemId: item.id,
          ...(homepageCinematic?.identity.stakeAddress
            ? { stakeAddress: homepageCinematic.identity.stakeAddress }
            : {}),
          ...(homepageCinematic?.identity.userId
            ? { userIdOrStakeAddress: homepageCinematic.identity.userId }
            : {}),
        });
        captureSenecaInteraction({
          kind:
            action === 'acknowledge'
              ? 'prioritization_item_acknowledged'
              : 'prioritization_item_dismissed',
          item_id: item.id,
          state: item.state,
          source: 'seneca_panel',
        });
      } catch (error) {
        captureSenecaInteraction({
          kind: 'prioritization_item_lifecycle_failed',
          action,
          item_id: item.id,
          state: item.state,
          error: error instanceof Error ? error.message : String(error),
          source: 'seneca_panel',
        });
      }
    },
    [homepageCinematic?.identity.stakeAddress, homepageCinematic?.identity.userId],
  );

  // Semantic search
  const senecaSearch = useSenecaSearch();

  // Anon option handler
  const handleAnonOption = useCallback(
    (option: GuidedOption) => {
      if (option.path) {
        captureSenecaInteraction({
          kind: 'path_chosen',
          path: option.path,
          source: 'onboarding',
        });
      } else {
        captureSenecaInteraction({
          kind: 'guided_option_chosen',
          choice: option.href ?? option.query ?? option.label,
          source: 'onboarding',
        });
      }
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

  const panelContent = (
    <>
      <span className="sr-only">Seneca conversation</span>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] shrink-0">
        <CompassSigil state={sigilState} size={18} accentColor={persona.accentColor} />
        <span className="text-sm font-semibold text-white">Seneca</span>
        {personaLabel && <span className="text-xs text-zinc-200">&middot; {personaLabel}</span>}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setSettingsOpen((current) => !current)}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            settingsOpen
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
          aria-label="Seneca settings"
          aria-pressed={settingsOpen}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>

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
        <p className="text-[11px] text-white">
          Now viewing: <span className="font-semibold">{ROUTE_LABELS[panelRoute]}</span>
        </p>
      </div>

      {settingsOpen && <MotionSettingsGroup />}

      {/* ── Content area ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent"
      >
        {mode === 'idle' && (
          <IdleContent
            panelRoute={panelRoute}
            isAuthenticated={isAuthenticated}
            quickActions={quickActions}
            anonOptions={anonOptions}
            onQuickAction={handleQuickAction}
            onAnonOption={handleAnonOption}
            cinematicPrimary={homepageCinematic?.queue.primary}
            cinematicSecondary={homepageCinematic?.queue.secondary}
            cinematicAnchoredCards={homepageAnchoredCards}
            panelOpen={isOpen}
            cinematicReasoning={homepageCinematic?.queue.meta.reasoning}
            cinematicSegment={segment}
            canRecordLifecycle={
              isAuthenticated &&
              !!(homepageCinematic?.identity.stakeAddress ?? homepageCinematic?.identity.userId)
            }
            onPrioritizationAction={handlePrioritizationAction}
            accentColor={persona.accentColor}
          />
        )}

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

        {mode === 'research' && pendingQuery && (
          <SenecaResearch question={pendingQuery} onBack={onReturnToIdle} />
        )}

        {mode === 'matching' && (
          <SenecaMatch
            onBack={onReturnToIdle}
            onStartConversation={(query) => {
              onReturnToIdle();
              setTimeout(() => onStartConversation(query), 100);
            }}
          />
        )}

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

      {(mode === 'idle' || mode === 'conversation') && (
        <div className="shrink-0 border-t border-white/[0.06]">
          <SenecaInput
            panelRoute={panelRoute}
            onSubmit={(query) => onStartConversation(query)}
            disabled={isStreaming}
          />
        </div>
      )}
    </>
  );

  if (viewportClass === 'mobile') {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn(
            'inset-0 h-[100dvh] w-screen max-w-none gap-0 p-0',
            'border-white/[0.08] bg-black/72 text-white backdrop-blur-2xl',
          )}
        >
          <SheetTitle className="sr-only">Seneca conversation</SheetTitle>
          {panelContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="seneca-thread-panel"
          initial={prefersReducedMotion ? false : { y: 24, scale: 0.96 }}
          animate={prefersReducedMotion ? undefined : { y: 0, scale: 1 }}
          exit={prefersReducedMotion ? undefined : { y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'fixed z-[60] flex flex-col overflow-hidden',
            'bg-black/75 backdrop-blur-2xl border border-white/[0.08]',
            'shadow-2xl shadow-black/40',
            'bottom-20 right-6 w-[380px] max-h-[70vh] rounded-2xl',
          )}
          role="dialog"
          aria-label="Seneca conversation"
          aria-modal="true"
        >
          {panelContent}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MotionSettingsGroup() {
  const { userOverride, setUserOverride } = useMotionStrengthSetter();

  const options: Array<{ value: MotionStrengthUserOverride; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'full', label: 'Full' },
    { value: 'suspended', label: 'Suspended' },
  ];

  return (
    <div
      className="shrink-0 border-b border-white/[0.04] px-3 py-3"
      data-testid="seneca-motion-settings"
    >
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">
        Motion
      </div>
      <RadioGroup
        value={userOverride}
        onValueChange={(value) => {
          if (value === 'auto' || value === 'full' || value === 'suspended') {
            setUserOverride(value);
          }
        }}
        className="grid grid-cols-3 gap-2"
        aria-label="Motion"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2',
              'text-xs text-white/70 transition-colors',
              userOverride === option.value
                ? 'border-primary/40 bg-primary/10 text-white'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
            )}
          >
            <RadioGroupItem value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

// Sub-components extracted to panel/SenecaIdle.tsx, panel/SenecaMessages.tsx, panel/SenecaSearchPanel.tsx
