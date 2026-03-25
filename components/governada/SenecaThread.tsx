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
import { CompassSigil } from '@/components/governada/CompassSigil';
import { SenecaMatch } from '@/components/governada/panel/SenecaMatch';
import { SenecaResearch } from '@/components/governada/panel/SenecaResearch';
import { SenecaInput } from '@/components/governada/panel/SenecaInput';
import { AIResponse } from '@/components/commandpalette/AIResponse';
import type { ThreadMessage } from '@/stores/senecaThreadStore';
import type { PanelRoute } from '@/hooks/useSenecaThread';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SenecaThreadProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'idle' | 'conversation' | 'research' | 'matching';
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
    default:
      return 'idle' as const;
  }
}

// ---------------------------------------------------------------------------
// Idle briefing messages per route
// ---------------------------------------------------------------------------

const IDLE_BRIEFINGS: Record<PanelRoute, string> = {
  hub: "Welcome. I'm tracking governance activity across the Cardano network. Ask me anything, or pick one of the quick actions below.",
  proposal:
    "I've analyzed this proposal's context, voting patterns, and treasury impact. Ask me for a summary or deeper analysis.",
  drep: "I can tell you about this representative's voting history, alignment profile, and how they compare to others.",
  'proposals-list':
    "Here's the current proposal landscape. I can help you filter, compare, or understand what's at stake.",
  'representatives-list':
    'Browse the representative directory. I can help you find someone who matches your governance priorities.',
  health:
    "I'm monitoring network governance health indicators. Ask about participation rates, quorum status, or trends.",
  treasury:
    'The treasury is the lifeblood of Cardano development. I can break down allocations, pending requests, and spending patterns.',
  workspace:
    'Your workspace is where proposals come to life. I can help with drafting, reviewing, or understanding the submission process.',
  default:
    "I'm Seneca, your governance companion. I can help you understand Cardano governance, find your representative, or analyze proposals.",
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
  action: 'conversation' | 'match' | 'navigate';
  query?: string;
  href?: string;
}

function getAnonOptions(route: PanelRoute): GuidedOption[] {
  switch (route) {
    case 'proposals-list':
      return [
        {
          label: 'What are these proposals about?',
          action: 'conversation',
          query: 'Explain what these governance proposals are about',
        },
        { label: 'Find my representative', action: 'match' },
        { label: 'How does governance work?', action: 'navigate', href: '/governance' },
      ];
    case 'hub':
      return [
        {
          label: "What's happening in governance?",
          action: 'conversation',
          query: "What's happening in Cardano governance right now?",
        },
        { label: 'Find my representative', action: 'match' },
        { label: 'How does governance work?', action: 'navigate', href: '/governance' },
      ];
    default:
      return [
        {
          label: 'Tell me about this page',
          action: 'conversation',
          query: `Explain what I'm looking at on the ${ROUTE_LABELS[route]} page`,
        },
        { label: 'Find my representative', action: 'match' },
        { label: 'How does governance work?', action: 'navigate', href: '/governance' },
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
  entityId: _entityId,
  pendingQuery,
  messages,
  onStartConversation,
  onStartResearch,
  onStartMatch,
  onReturnToIdle,
  onAddMessage: _onAddMessage,
  onUpdateLastAssistant: _onUpdateLastAssistant,
  onClearConversation,
  onGlobeCommand,
  onEntityFocus,
  isAuthenticated,
}: SenecaThreadProps) {
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevRouteRef = useRef<PanelRoute>(panelRoute);

  // Track route changes for navigation markers in conversation
  const [routeChanged, setRouteChanged] = useState(false);
  useEffect(() => {
    if (prevRouteRef.current !== panelRoute) {
      setRouteChanged(true);
      prevRouteRef.current = panelRoute;
      const t = setTimeout(() => setRouteChanged(false), 100);
      return () => clearTimeout(t);
    }
  }, [panelRoute]);

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
          // Navigate handled externally — for now treat as conversation
          if (option.href) {
            window.location.href = option.href;
          }
          break;
      }
    },
    [onStartConversation, onStartMatch],
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
            variants={prefersReducedMotion ? undefined : undefined}
            initial={prefersReducedMotion ? { opacity: 0 } : undefined}
            animate={prefersReducedMotion ? { opacity: 1 } : undefined}
            exit={prefersReducedMotion ? { opacity: 0 } : undefined}
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
                  onEntityFocus={onEntityFocus}
                  routeChanged={routeChanged}
                  routeLabel={ROUTE_LABELS[panelRoute]}
                  accentColor={persona.accentColor}
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
            </div>

            {/* ── Input area ── */}
            {(mode === 'idle' || mode === 'conversation') && (
              <div className="shrink-0">
                {isAuthenticated ? (
                  <SenecaInput
                    panelRoute={panelRoute}
                    onSubmit={(query) => onStartConversation(query)}
                    disabled={false}
                  />
                ) : // Anonymous: no free-text input, options are in the content area
                mode === 'idle' ? null : (
                  <SenecaInput
                    panelRoute={panelRoute}
                    onSubmit={(query) => onStartConversation(query)}
                    disabled={false}
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

function ConversationContent({
  messages,
  onEntityFocus,
  routeChanged,
  routeLabel,
  accentColor,
}: {
  messages: ThreadMessage[];
  onEntityFocus?: (entityType: string, entityId: string) => void;
  routeChanged: boolean;
  routeLabel: string;
  accentColor?: string;
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

      {messages.map((msg) => {
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

        // Assistant message
        const isStreaming = msg.content === '' || msg.content.endsWith('\u200B');

        return (
          <div key={msg.id} className="flex gap-2 items-start px-3 py-2">
            <div className="shrink-0 mt-1">
              <CompassSigil
                state={isStreaming ? 'thinking' : 'idle'}
                size={14}
                accentColor={accentColor}
              />
            </div>
            <div className="flex-1 min-w-0">
              <AIResponse
                content={msg.content}
                isStreaming={isStreaming}
                onEntityFocus={onEntityFocus}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
