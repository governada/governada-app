'use client';

/**
 * CompassPanel — Seneca, your governance advisor.
 *
 * A conversational panel that feels like talking to a Stoic philosopher
 * who happens to know everything about Cardano governance.
 *
 * Structure:
 * 1. Header — Seneca branding + context
 * 2. Seneca's opening remark — contextual, page-aware, in character
 * 3. Suggestion chips — discoverable actions framed as Seneca's advice
 * 4. Conversation thread — the primary experience
 * 5. Input — always visible at bottom
 */

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ScrollText,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Lock,
  ArrowUp,
  Info,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDiscovery } from '@/hooks/useDiscovery';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useAdvisor, getRemainingMessages } from '@/hooks/useAdvisor';
import { getCompassState, getCompassProgression } from '@/lib/funnel';
import { posthog } from '@/lib/posthog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES_PER_DAY = 10;

const SENECA_TOOLTIP =
  'Inspired by Seneca the Younger (c.\u00A04\u00A0BC\u2013AD\u00A065) \u2014 Stoic philosopher, statesman, and advisor whose letters on governance remain influential two millennia later.';

// ---------------------------------------------------------------------------
// Seneca's opening remarks — contextual, in character
// ---------------------------------------------------------------------------

const SENECA_GREETINGS: Record<string, string> = {
  governance:
    "Welcome. Cardano's governance has been active — let me catch you up on what matters.",
  proposals:
    "These decisions will shape Cardano for years. Want me to walk you through what's at stake?",
  dreps:
    'Choosing a representative is choosing who speaks for you. I can help you find one whose actions — not just words — align with yours.',
  treasury:
    '"Wealth consists not in having great possessions, but in having few wants." Still, this treasury belongs to everyone. Ask me anything about how it\'s being spent.',
  spos: 'Your staking choice is also a governance choice. Let me show you which pools take both responsibilities seriously.',
  match:
    "Good — you want to know where you stand. Answer honestly, and I'll show you who actually matches your values.",
  you: "Let's look at your governance footprint. Are you participating, or merely observing?",
  help: "I'm here. What would you like to understand about governance?",
};

const SENECA_DEFAULT_GREETING =
  "I've been studying Cardano's governance closely. Ask me anything — proposals, representatives, treasury, or your own participation.";

const SENECA_ANONYMOUS_GREETING =
  "I'm Seneca — your governance advisor. I can help you understand proposals, find representatives who share your values, and navigate the treasury. Connect your wallet to unlock the full conversation, or start with the match quiz below.";

const SENECA_ONBOARDING_GREETING =
  'Welcome to Cardano governance. Every light in that constellation is someone governing a \u20BF2B treasury. Let me help you find where you fit \u2014 it takes about 90 seconds.';

// ---------------------------------------------------------------------------
// Suggestion chips — framed as Seneca's advice
// ---------------------------------------------------------------------------

interface Suggestion {
  label: string;
  href?: string;
  tourId?: string;
  startRoute?: string;
  action?: 'quiz' | 'wallet';
}

interface SuggestionContext {
  currentPage: string | undefined;
  progression: ReturnType<typeof getCompassProgression>;
  tours: { id: string; label: string; startRoute: string; section?: string }[];
  toursCompleted: string[];
  matchState?: 'idle' | 'matching' | 'matched' | 'delegated';
  walletState?: 'none_detected' | 'detected' | 'connected' | 'has_ada' | 'no_ada';
  isSegmentUpgrade?: boolean;
}

function getSuggestions(ctx: SuggestionContext): Suggestion[] {
  const {
    currentPage,
    progression,
    tours,
    toursCompleted,
    matchState,
    walletState,
    isSegmentUpgrade,
  } = ctx;
  const suggestions: Suggestion[] = [];

  // Segment upgrade: citizen welcome chips
  if (isSegmentUpgrade) {
    suggestions.push({ label: 'Explore active proposals', href: '/governance/proposals' });
    suggestions.push({ label: "Check my DRep's activity", href: '/my-gov' });
    return suggestions.slice(0, 3);
  }

  // Post-match segment-aware chips
  if (matchState === 'matched') {
    if (walletState === 'detected') {
      suggestions.push({ label: 'Connect & Delegate', action: 'wallet' });
    } else if (walletState === 'none_detected') {
      suggestions.push({ label: 'Get a wallet to delegate', href: '/help' });
    } else if (walletState === 'no_ada') {
      suggestions.push({ label: 'How to get ADA', href: '/help' });
    } else if (walletState === 'has_ada' || walletState === 'connected') {
      suggestions.push({ label: 'Delegate Now', href: '/match' });
    }
  }

  // Page-specific tour
  if (currentPage) {
    const pageTour = tours.find((t) => !toursCompleted.includes(t.id) && t.section === currentPage);
    if (pageTour) {
      suggestions.push({
        label: `Show me around ${currentPage === 'dreps' ? 'Representatives' : currentPage}`,
        tourId: pageTour.id,
        startRoute: pageTour.startRoute,
      });
    }
  }

  // Quiz suggestion
  if (progression === 'first_visit' || progression === 'exploring') {
    suggestions.push({
      label: 'Find my governance match',
      href: '/match',
      action: 'quiz',
    });
  }

  // Wallet suggestion (post-quiz, no match-specific chip already added)
  if (progression === 'quiz_completed' && matchState !== 'matched') {
    suggestions.push({
      label: 'Connect to see my full profile',
      action: 'wallet',
    });
  }

  // Post-connect suggestion
  if (progression === 'connected' && matchState !== 'matched') {
    suggestions.push({ label: 'Explore what your DRep has been voting on', href: '/my-gov' });
  }

  // Contextual suggestions based on page
  if (currentPage === 'proposals') {
    suggestions.push({ label: 'Explain the active proposals', href: '/governance/proposals' });
  } else if (currentPage === 'dreps') {
    suggestions.push({ label: "Who's rising this epoch?", href: '/governance/representatives' });
  } else if (currentPage === 'treasury') {
    suggestions.push({ label: 'How long will the treasury last?', href: '/governance/treasury' });
  }

  return suggestions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompassPanelProps {
  currentPage?: string;
  onStartTour: (tourId: string, startRoute: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// StreamingDots
// ---------------------------------------------------------------------------

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Thinking">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompassPanel({ currentPage, onStartTour, onClose }: CompassPanelProps) {
  const { segment } = useSegment();
  const { state, tours, explorationProgress } = useDiscovery();

  const compassState = getCompassState();
  const progression = getCompassProgression(compassState);

  // Advisor state
  const { messages, sendMessage, isStreaming, error, clearMessages } = useAdvisor({
    pageContext: currentPage,
  });
  const [inputValue, setInputValue] = useState('');
  const [remaining, setRemaining] = useState(getRemainingMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAnonymous = segment === 'anonymous' || !segment;

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setRemaining(getRemainingMessages());
  }, [messages.length]);

  // Seneca's opening — contextual to page and progression
  const greeting = isAnonymous
    ? progression === 'first_visit'
      ? SENECA_ONBOARDING_GREETING
      : SENECA_ANONYMOUS_GREETING
    : (currentPage && SENECA_GREETINGS[currentPage]) || SENECA_DEFAULT_GREETING;

  // Suggestions
  const suggestions = isAnonymous
    ? [
        { label: 'Find my governance match', href: '/match', action: 'quiz' as const },
        { label: 'What is governance?', href: '/governance/health' },
      ]
    : getSuggestions({
        currentPage,
        progression,
        tours,
        toursCompleted: state.toursCompleted,
      });

  // Progress
  const progressPercent = explorationProgress.percent;

  // Handlers
  const handleTourStart = useCallback(
    (tourId: string, startRoute: string) => {
      posthog.capture('discovery_tour_started', { tour_id: tourId, source: 'seneca' });
      onStartTour(tourId, startRoute);
    },
    [onStartTour],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    setInputValue('');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/30">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <ScrollText className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h2 className="inline-flex items-center gap-1 text-base font-semibold cursor-help">
                  Seneca
                  <Info className="h-3 w-3 text-muted-foreground/40" />
                </h2>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4} className="max-w-[260px]">
                {SENECA_TOOLTIP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-xs text-muted-foreground">Your governance advisor</p>
        </div>
        {/* Compact progress indicator */}
        {progressPercent > 0 && progressPercent < 100 && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
            {progressPercent}% explored
          </span>
        )}
        {progressPercent === 100 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 shrink-0">
            <CheckCircle2 className="h-3 w-3" />
            Explored
          </span>
        )}
      </div>

      {/* ── Conversation area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-hide">
        {/* Seneca's opening remark — always shown, acts as the "first message" */}
        <div className="flex gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
            <ScrollText className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground leading-relaxed italic">{greeting}</p>
          </div>
        </div>

        {/* Suggestion chips — Seneca's recommendations */}
        {suggestions.length > 0 && messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-10">
            {suggestions.map((s, i) => (
              <SuggestionChip
                key={i}
                suggestion={s}
                onTourStart={handleTourStart}
                onClose={onClose}
              />
            ))}
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg, idx) => (
          <div key={idx} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
                <ScrollText className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed',
                msg.role === 'user' ? 'bg-teal-600 text-white' : 'text-muted-foreground italic',
              )}
            >
              {msg.content ||
                (isStreaming && idx === messages.length - 1 ? <StreamingDots /> : null)}
              {msg.role === 'assistant' &&
                msg.content.length > 0 &&
                isStreaming &&
                idx === messages.length - 1 && (
                  <span className="ml-1 inline-block">
                    <StreamingDots />
                  </span>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />

        {/* Clear conversation */}
        {messages.length >= 2 && !isStreaming && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                clearMessages();
                setInputValue('');
                inputRef.current?.focus();
              }}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Clear conversation
            </button>
          </div>
        )}
      </div>

      {/* ── Input area (sticky bottom) ── */}
      <div className="border-t border-border/30 shrink-0">
        {error && (
          <div className="px-5 py-1.5">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {isAnonymous ? (
          <div className="px-5 py-3">
            <Link
              href="/match"
              className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground/60 hover:bg-muted/50 transition-colors"
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span>Connect wallet to continue the conversation</span>
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex items-center gap-2 px-5 py-3">
              <MessageCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Seneca anything..."
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isStreaming}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
                  inputValue.trim() && !isStreaming
                    ? 'bg-teal-600 text-white hover:bg-teal-500'
                    : 'bg-muted/50 text-muted-foreground/40',
                )}
                aria-label="Send message"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </form>

            <div className="px-5 pb-2">
              <p className="text-[10px] text-muted-foreground/40">
                {remaining}/{MAX_MESSAGES_PER_DAY} questions remaining today
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuggestionChip
// ---------------------------------------------------------------------------

function SuggestionChip({
  suggestion,
  onTourStart,
  onClose,
}: {
  suggestion: Suggestion;
  onTourStart: (tourId: string, startRoute: string) => void;
  onClose: () => void;
}) {
  if (suggestion.tourId && suggestion.startRoute) {
    return (
      <button
        onClick={() => onTourStart(suggestion.tourId!, suggestion.startRoute!)}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
      >
        {suggestion.label}
        <ChevronRight className="h-3 w-3" />
      </button>
    );
  }

  if (suggestion.href) {
    return (
      <Link
        href={suggestion.href}
        onClick={onClose}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
      >
        {suggestion.label}
        <ChevronRight className="h-3 w-3" />
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
      <Sparkles className="h-3 w-3" />
      {suggestion.label}
    </span>
  );
}
