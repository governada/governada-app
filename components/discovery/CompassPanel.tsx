'use client';

/**
 * CompassPanel — Unified discovery + contextual guidance + AI advisor panel.
 *
 * Replaces the old DiscoveryPanel with a merged experience:
 * 1. Header with Compass branding + progress ring
 * 2. "For You Right Now" — single most relevant action
 * 3. "Continue Exploring" — compact feature checklist
 * 4. Milestones — recent achievement pills
 * 5. Advisor — always-visible chat at the bottom
 */

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Navigation2,
  CheckCircle2,
  Circle,
  Play,
  ChevronRight,
  Trophy,
  Sparkles,
  Lock,
  ArrowUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDiscovery } from '@/hooks/useDiscovery';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useAdvisor, getRemainingMessages } from '@/hooks/useAdvisor';
import { getCompassState, getCompassProgression } from '@/lib/funnel';
import { posthog } from '@/lib/posthog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES_PER_DAY = 10;

const PAGE_LABELS: Record<string, string> = {
  governance: 'Governance Overview',
  dreps: 'Representatives',
  proposals: 'Proposals',
  treasury: 'Treasury',
  spos: 'Stake Pool Operators',
  match: 'Governance Match',
  workspace: 'Workspace',
  you: 'Your Profile',
  help: 'Help',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompassPanelProps {
  /** Which page the user is currently on */
  currentPage?: string;
  /** Callback to start a tour (closes panel, navigates, starts tour) */
  onStartTour: (tourId: string, startRoute: string) => void;
  /** Close the panel */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Streaming dots indicator
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
  const { state, featuresByCategory, tours, explorationProgress, markFeatureExplored } =
    useDiscovery();

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

  // Auto-scroll advisor messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update remaining count after sending
  useEffect(() => {
    setRemaining(getRemainingMessages());
  }, [messages.length]);

  // --- Progress ring ---
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (explorationProgress.percent / 100) * circumference;

  // --- Page subtitle ---
  const pageLabel = currentPage ? PAGE_LABELS[currentPage] : undefined;
  const subtitle = pageLabel ? `You're exploring ${pageLabel}` : 'Your governance companion';

  // --- "For You Right Now" logic: pick single most relevant action ---
  const forYouAction = getForYouAction(currentPage, state, tours, progression);

  // --- Feature list: split into explored vs unexplored ---
  const allFeatures = featuresByCategory.flatMap((cat) =>
    cat.features.map((f) => ({ ...f, categoryLabel: cat.label })),
  );
  const exploredFeatures = allFeatures.filter((f) => state.featuresExplored.includes(f.id));
  const unexploredFeatures = allFeatures.filter((f) => !state.featuresExplored.includes(f.id));

  // --- Handlers ---
  const handleFeatureClick = useCallback(
    (featureId: string) => {
      markFeatureExplored(featureId);
      posthog.capture('discovery_feature_clicked', { feature_id: featureId });
      onClose();
    },
    [markFeatureExplored, onClose],
  );

  const handleTourStart = useCallback(
    (tourId: string, startRoute: string) => {
      posthog.capture('discovery_tour_started', { tour_id: tourId, source: 'compass' });
      onStartTour(tourId, startRoute);
    },
    [onStartTour],
  );

  function handleAdvisorSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    setInputValue('');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 1. Header ── */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Navigation2 className="h-5 w-5 text-teal-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">Compass Guide</h2>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>
        {/* Progress ring */}
        <div className="relative h-11 w-11 shrink-0">
          <svg viewBox="0 0 48 48" className="-rotate-90" aria-hidden="true">
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-muted/20"
            />
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-teal-400 transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
            {explorationProgress.percent}%
          </span>
        </div>
      </div>

      {/* ── Scrollable middle content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-hide">
        {/* ── 2. For You Right Now ── */}
        {forYouAction && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              For You Right Now
            </h3>
            <ForYouCard action={forYouAction} onTourStart={handleTourStart} onClose={onClose} />
          </div>
        )}

        {/* ── 3. Continue Exploring ── */}
        {unexploredFeatures.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Continue Exploring
            </h3>

            {/* Explored summary */}
            {exploredFeatures.length > 0 && (
              <p className="text-xs text-muted-foreground/60 mb-2">
                <CheckCircle2 className="inline h-3 w-3 text-emerald-500 mr-1" />
                {exploredFeatures.length} explored
              </p>
            )}

            {/* Unexplored features — compact rows */}
            <div className="space-y-0.5">
              {unexploredFeatures.map((feature) => (
                <Link
                  key={feature.id}
                  href={feature.href}
                  onClick={() => handleFeatureClick(feature.id)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-primary/5"
                >
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="text-sm font-medium truncate">{feature.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Milestones ── */}
        {state.milestonesShown.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <Trophy className="h-3.5 w-3.5" />
              Milestones
            </h3>
            <div className="flex flex-wrap gap-2">
              {state.milestonesShown.slice(-3).map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20"
                >
                  <Trophy className="h-3 w-3" />
                  {id.replace(/-/g, ' ').replace(/^first /, '')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Advisor section (sticky bottom) ── */}
      <div className="border-t border-border/30 shrink-0">
        {/* Advisor header */}
        <div className="flex items-center gap-2 px-4 py-2">
          <Sparkles className="h-3.5 w-3.5 text-teal-400 shrink-0" />
          <span className="text-xs font-medium text-muted-foreground flex-1">
            Governance Advisor
          </span>
          <span className="rounded-full bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-400">
            Beta
          </span>
        </div>

        {isAnonymous ? (
          /* Locked teaser for anonymous users */
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground/60">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Connect wallet to ask questions</span>
            </div>
          </div>
        ) : (
          <>
            {/* Messages area */}
            {messages.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto px-4 py-2 border-t border-border/20">
                <div className="flex flex-col gap-2">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-lg px-3 py-1.5 text-sm',
                          msg.role === 'user'
                            ? 'bg-teal-600 text-white'
                            : 'bg-muted/50 text-foreground',
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
                </div>

                {/* Clear conversation */}
                {messages.length >= 2 && !isStreaming && (
                  <div className="mt-1 flex justify-center">
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
            )}

            {/* Error display */}
            {error && (
              <div className="px-4 py-1.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={handleAdvisorSubmit}
              className="flex items-center gap-2 px-4 py-2.5 border-t border-border/20"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask any governance question..."
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

            {/* Rate limit footer */}
            <div className="px-4 pb-2">
              <p className="text-[10px] text-muted-foreground/50">
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
// "For You Right Now" action types + logic
// ---------------------------------------------------------------------------

type ForYouActionType = 'tour' | 'quiz' | 'wallet' | 'insight';

interface ForYouAction {
  type: ForYouActionType;
  label: string;
  description: string;
  tourId?: string;
  startRoute?: string;
  href?: string;
}

interface MiniTourLike {
  id: string;
  label: string;
  startRoute: string;
  section?: string;
}

function getForYouAction(
  currentPage: string | undefined,
  state: { toursCompleted: string[]; featuresExplored: string[] },
  tours: MiniTourLike[],
  progression: ReturnType<typeof getCompassProgression>,
): ForYouAction | null {
  // Priority 1: Page-specific uncompleted tour
  if (currentPage) {
    const pageTour = tours.find(
      (t) =>
        !state.toursCompleted.includes(t.id) &&
        ('section' in t ? t.section === currentPage : false),
    );
    if (pageTour) {
      return {
        type: 'tour',
        label: `Take a quick tour of ${PAGE_LABELS[currentPage] ?? currentPage}`,
        description: 'See what you can do here',
        tourId: pageTour.id,
        startRoute: pageTour.startRoute,
      };
    }
  }

  // Priority 1b: Any uncompleted tour
  const anyTour = tours.find((t) => !state.toursCompleted.includes(t.id));
  if (anyTour) {
    return {
      type: 'tour',
      label: anyTour.label,
      description: 'Take a guided tour',
      tourId: anyTour.id,
      startRoute: anyTour.startRoute,
    };
  }

  // Priority 2: Quiz not completed
  if (progression === 'first_visit' || progression === 'exploring') {
    return {
      type: 'quiz',
      label: 'Find your governance match in 60 seconds',
      description: 'Discover DReps aligned with your values',
      href: '/match',
    };
  }

  // Priority 3: Quiz done, wallet not connected
  if (progression === 'quiz_completed') {
    return {
      type: 'wallet',
      label: 'Connect to see your full governance profile',
      description: 'Unlock personalized insights and delegation',
    };
  }

  // Priority 4: Connected — contextual insight
  if (progression === 'connected') {
    return {
      type: 'insight',
      label: 'Ask the Compass about anything on this page',
      description: 'Your AI advisor is ready below',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// ForYouCard component
// ---------------------------------------------------------------------------

interface ForYouCardProps {
  action: ForYouAction;
  onTourStart: (tourId: string, startRoute: string) => void;
  onClose: () => void;
}

function ForYouCard({ action, onTourStart, onClose }: ForYouCardProps) {
  const iconMap: Record<ForYouActionType, typeof Play> = {
    tour: Play,
    quiz: ChevronRight,
    wallet: ChevronRight,
    insight: Sparkles,
  };
  const Icon = iconMap[action.type];

  if (action.type === 'tour' && action.tourId && action.startRoute) {
    return (
      <button
        onClick={() => onTourStart(action.tourId!, action.startRoute!)}
        className="flex items-center gap-3 w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-teal-500/5 border border-teal-500/20 bg-teal-500/5"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/10 shrink-0">
          <Icon className="h-3.5 w-3.5 text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{action.label}</p>
          <p className="text-xs text-muted-foreground truncate">{action.description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-teal-400 shrink-0" />
      </button>
    );
  }

  if (action.href) {
    return (
      <Link
        href={action.href}
        onClick={onClose}
        className="flex items-center gap-3 w-full rounded-lg px-3 py-3 transition-colors hover:bg-teal-500/5 border border-teal-500/20 bg-teal-500/5"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/10 shrink-0">
          <Icon className="h-3.5 w-3.5 text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{action.label}</p>
          <p className="text-xs text-muted-foreground truncate">{action.description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-teal-400 shrink-0" />
      </Link>
    );
  }

  // Wallet CTA or insight — just a visual card (no link)
  return (
    <div className="flex items-center gap-3 w-full rounded-lg px-3 py-3 border border-teal-500/20 bg-teal-500/5">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/10 shrink-0">
        <Icon className="h-3.5 w-3.5 text-teal-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{action.label}</p>
        <p className="text-xs text-muted-foreground truncate">{action.description}</p>
      </div>
    </div>
  );
}
