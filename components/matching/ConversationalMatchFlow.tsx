'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Loader2, RotateCcw, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { posthog } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { PillCloud } from './PillCloud';
import { ConversationalRound } from './ConversationalRound';
import { SemanticFastTrack } from './SemanticFastTrack';
import { MatchResults } from './MatchResults';
import { useConversationalMatch } from '@/hooks/useConversationalMatch';
import { saveConversationalProfile, saveAlignmentHistory } from '@/lib/matchStore';
import { blockTimeToEpoch } from '@/lib/koios';
import { sendMatchSignals } from '@/lib/matchSignals';
import { cn } from '@/lib/utils';
import type { ConstellationRef } from '@/components/GovernanceConstellation';

/* ─── Types ─────────────────────────────────────────────── */

type FlowState = 'idle' | 'matching' | 'results';

interface ConversationalMatchFlowProps {
  globeRef: React.RefObject<ConstellationRef | null>;
  onMatchStart?: () => void;
  onMatchComplete?: (matches: unknown[]) => void;
  /** Pre-selected topic hints (from URL params) */
  initialTopics?: string[];
  /** Auto-start the session immediately (when arriving from homepage pill tap) */
  autoStart?: boolean;
}

/* ─── Fallback topic pills (used when API is unavailable) ── */

const FALLBACK_TOPICS = [
  { id: 'topic-treasury', text: 'Treasury', trending: false },
  { id: 'topic-innovation', text: 'Innovation', trending: false },
  { id: 'topic-security', text: 'Security', trending: false },
  { id: 'topic-transparency', text: 'Transparency', trending: false },
  { id: 'topic-decentralization', text: 'Decentralization', trending: false },
  { id: 'topic-developer-funding', text: 'Developer Funding', trending: false },
  { id: 'topic-community-growth', text: 'Community Growth', trending: false },
  { id: 'topic-constitutional', text: 'Constitutional Compliance', trending: false },
] as const;

/* ─── Dynamic topic API types ──────────────────────────── */

interface MatchingTopicResponse {
  topics: Array<{
    id: string;
    slug: string;
    displayText: string;
    source: string;
    trending: boolean;
    selectionCount: number;
  }>;
}

/** Fire-and-forget: increment selection count for a topic */
function trackTopicSelection(slug: string): void {
  fetch('/api/governance/matching-topics/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  }).catch(() => {
    // Non-critical telemetry — silently swallow
  });
}

/* ─── Ghost text rotation ───────────────────────────────── */

const GHOST_TEXTS = [
  'Or tell us what matters...',
  'What should Cardano prioritize?',
  'How should the treasury be used?',
  'What kind of governance do you want?',
];

function useGhostText(intervalMs = 3500): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % GHOST_TEXTS.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return GHOST_TEXTS[index];
}

/* ─── Haptic feedback (mobile vibration at key moments) ─── */

function hapticFeedback(pattern: 'light' | 'medium' | 'heavy' | 'success') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  switch (pattern) {
    case 'light':
      navigator.vibrate(10);
      break;
    case 'medium':
      navigator.vibrate(25);
      break;
    case 'heavy':
      navigator.vibrate([30, 50, 30]);
      break;
    case 'success':
      navigator.vibrate([20, 80, 20, 80, 40]);
      break;
  }
}

/* ─── Globe threshold by round ──────────────────────────── */

function getThresholdForRound(round: number): number {
  // Progressive convergence — each round dramatically narrows the highlighted nodes
  // Round 1: broad scan (~60% of nodes), Round 4: laser focus (~5% of nodes)
  switch (round) {
    case 1:
      return 160;
    case 2:
      return 100;
    case 3:
      return 60;
    default:
      return 35;
  }
}

/* ─── URL state helpers ─────────────────────────────────── */

function pushUrlState(state: string, hash: string) {
  if (typeof window !== 'undefined') {
    window.history.pushState({ state }, '', `/#${hash}`);
  }
}

/* ─── Component ─────────────────────────────────────────── */

export function ConversationalMatchFlow({
  globeRef,
  onMatchStart,
  onMatchComplete,
  initialTopics,
  autoStart,
}: ConversationalMatchFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(
    () => new Set(initialTopics ?? []),
  );
  const [freeformText, setFreeformText] = useState('');
  const [showFastTrack, setShowFastTrack] = useState(false);
  const [pendingSemanticText, setPendingSemanticText] = useState<string | null>(null);
  const hasStartedRef = useRef(false);
  const ghostText = useGhostText();

  /* ─── Fetch dynamic topics from API ──────────────────── */

  const { data: topicsData } = useQuery<MatchingTopicResponse>({
    queryKey: ['matching-topics'],
    queryFn: async () => {
      const res = await fetch('/api/governance/matching-topics');
      if (!res.ok) throw new Error('Failed to fetch topics');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  /** Dynamic pills — falls back to hardcoded list if API unavailable */
  const topicPills = useMemo(() => {
    if (topicsData?.topics && topicsData.topics.length > 0) {
      return topicsData.topics.map((t) => ({
        id: `topic-${t.slug}`,
        text: t.displayText,
        trending: t.trending,
      }));
    }
    return FALLBACK_TOPICS.map((t) => ({ id: t.id, text: t.text, trending: t.trending }));
  }, [topicsData]);

  const {
    round,
    question,
    status,
    preview,
    matches,
    spoMatches,
    userAlignments,
    personalityLabel,
    identityColor,
    confidence,
    usedSemantic,
    isLoading,
    error,
    startSession,
    submitAnswer,
    getMatches,
    reset,
  } = useConversationalMatch();

  const prefersReducedMotion = useReducedMotion();
  const motionTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.2 };
  /* ─── URL popstate handler ─────────────────────────────── */

  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      if (e.state?.state === 'matching') {
        // Allow back to matching state — but we don't auto-restart
      } else if (flowState === 'matching') {
        // Back button during matching → reset to idle
        handleReset();
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowState]);

  /* ─── Sync hook status → flow state ────────────────────── */

  // Auto-trigger match when ready — skip "ready" intermediate state
  const hasAutoMatchedRef = useRef(false);
  useEffect(() => {
    if (status === 'ready_to_match' && flowState === 'matching' && !hasAutoMatchedRef.current) {
      hasAutoMatchedRef.current = true;
      hapticFeedback('heavy');
      getMatches();
    }
    if (status === 'matched' && flowState !== 'results') {
      hapticFeedback('success');

      // Fly to the top match node — wait for the dramatic "Cerebro found you" moment
      // before revealing results. The globe holds for 3s during flyToMatch.
      const revealResults = () => {
        setFlowState('results');
        pushUrlState('results', 'results');
      };

      if (matches && matches.length > 0 && globeRef.current?.flyToMatch) {
        globeRef.current.flyToMatch(matches[0].drepId).then(revealResults).catch(revealResults);
      } else {
        revealResults();
      }
      if (matches) {
        onMatchComplete?.(matches);
        posthog.capture('match_completed', {
          rounds: round,
          usedSemantic: usedSemantic,
          matchCount: matches.length,
        });
        // Persist conversational profile for later use
        if (personalityLabel && identityColor && userAlignments) {
          saveConversationalProfile({
            personalityLabel,
            identityColor,
            alignments: userAlignments,
            matchResults: matches,
            timestamp: Date.now(),
          });

          // Save alignment history for evolution tracking
          const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
          saveAlignmentHistory(userAlignments, personalityLabel, currentEpoch);

          // Fire-and-forget: send anonymous match signals for community intelligence
          sendMatchSignals({
            selectedTopics,
            userAlignments,
            personalityLabel,
            matches,
          });
        }
      }
    }
  }, [
    status,
    flowState,
    matches,
    round,
    usedSemantic,
    personalityLabel,
    identityColor,
    userAlignments,
    selectedTopics,
    onMatchComplete,
    getMatches,
  ]);

  /* ─── Update globe highlights after each answer ────────── */

  useEffect(() => {
    if (flowState === 'matching' && preview && round > 0 && globeRef.current) {
      // Build a partial alignment vector from preview data
      // The coverage percentage gives us an idea of how much we know
      const threshold = getThresholdForRound(round);
      // Use dimensional coverage as a proxy — more coverage = narrower highlights
      const coverageWeight = Math.min(preview.dimensionalCoverage / 6, 1);
      const effectiveThreshold = Math.round(180 - coverageWeight * (180 - threshold));
      // Create a simple alignment vector (6 dimensions, centered at 50)
      // The actual alignment will come from the API; this drives visual convergence
      const alignmentVector = [50, 50, 50, 50, 50, 50];
      globeRef.current.highlightMatches(alignmentVector, effectiveThreshold);
    }
  }, [flowState, preview, round, globeRef]);

  /* ─── Start matching flow ──────────────────────────────── */

  const handleInitialInteraction = useCallback(
    async (extraTopics?: string[]) => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      hapticFeedback('light');
      onMatchStart?.();
      setFlowState('matching');
      pushUrlState('matching', 'matching');
      posthog.capture('match_flow_started');

      // Merge any extra topics (from the triggering pill tap) with already-selected topics
      const allTopics = new Set(selectedTopics);
      if (extraTopics) extraTopics.forEach((t) => allTopics.add(t));
      const topicHints = allTopics.size > 0 ? Array.from(allTopics) : undefined;
      await startSession(topicHints);
    },
    [onMatchStart, startSession, selectedTopics],
  );

  /* ─── Auto-start when arriving from homepage with topic ── */

  useEffect(() => {
    if (autoStart && !hasStartedRef.current) {
      handleInitialInteraction(initialTopics);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Topic pill toggle ────────────────────────────────── */

  const handleTopicToggle = useCallback(
    (id: string) => {
      setSelectedTopics((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          // Fire-and-forget: track selection for community intelligence
          const slug = id.replace(/^topic-/, '');
          trackTopicSelection(slug);
        }
        return next;
      });

      // Auto-start on first pill tap — pass the tapped topic so question order adapts
      if (!hasStartedRef.current) {
        handleInitialInteraction([id]);
      }
    },
    [handleInitialInteraction],
  );

  /* ─── Freeform text submit ─────────────────────────────── */

  const handleFreeformKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && freeformText.trim().length >= 10) {
        e.preventDefault();
        if (!hasStartedRef.current) {
          handleInitialInteraction();
        }
      }
    },
    [freeformText, handleInitialInteraction],
  );

  /* ─── Semantic fast-track submit ──────────────────────── */

  const handleSemanticSubmit = useCallback(
    async (text: string) => {
      // Store the text to be included with the first round answer
      setPendingSemanticText(text);
      posthog.capture('match_semantic_entered');

      // Start the session — the pill flow still runs, but the semantic text
      // will be threaded through as rawText on the first round answer
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        onMatchStart?.();
        setFlowState('matching');
        pushUrlState('matching', 'matching');
        const topicHints = selectedTopics.size > 0 ? Array.from(selectedTopics) : undefined;
        await startSession(topicHints);
      }
    },
    [onMatchStart, startSession, selectedTopics],
  );

  /* ─── Conversational round answer ──────────────────────── */

  const handleAnswer = useCallback(
    (selectedIds: string[], rawText?: string) => {
      // If there's pending semantic text from fast-track, prepend it
      const combinedText = pendingSemanticText
        ? pendingSemanticText + (rawText ? ' ' + rawText : '')
        : rawText;

      // Clear pending text after first use
      if (pendingSemanticText) {
        setPendingSemanticText(null);
      }

      const method =
        selectedIds.length > 0 && combinedText ? 'both' : combinedText ? 'text' : 'pill';
      posthog.capture('match_round_completed', { round, method });

      hapticFeedback('medium');
      submitAnswer(selectedIds, combinedText || undefined);
    },
    [submitAnswer, pendingSemanticText, round],
  );

  /* ─── Continue refining (restart session, go back to matching) ── */

  const handleReset = useCallback(async () => {
    posthog.capture('match_continue_refining');
    reset();
    hasAutoMatchedRef.current = false;
    hasStartedRef.current = true;
    setFlowState('matching');
    setPendingSemanticText(null);
    pushUrlState('matching', 'matching');
    globeRef.current?.clearMatches();
    // Start a fresh session — preserve topic context for question ordering
    const topicHints = selectedTopics.size > 0 ? Array.from(selectedTopics) : undefined;
    await startSession(topicHints);
  }, [reset, globeRef, startSession, selectedTopics]);

  /* ─── Render: Idle state ───────────────────────────────── */

  if (flowState === 'idle') {
    return (
      <div className="w-full space-y-4">
        <AnimatePresence mode="wait">
          {showFastTrack ? (
            <motion.div
              key="fast-track"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={motionTransition}
              className="space-y-3 rounded-2xl bg-black/40 backdrop-blur-md p-5 border border-white/[0.06] max-md:-mx-6 max-md:w-[calc(100%+3rem)] max-md:rounded-none max-md:border-x-0"
            >
              <p className="text-center text-sm text-white/70">Express yourself freely</p>

              <SemanticFastTrack onSubmit={handleSemanticSubmit} isProcessing={isLoading} />

              <button
                onClick={() => setShowFastTrack(false)}
                className="block mx-auto text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                &larr; Back to topic pills
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="pills"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={motionTransition}
              className="space-y-4 rounded-2xl bg-black/40 backdrop-blur-md p-5 border border-white/[0.06] max-md:-mx-6 max-md:w-[calc(100%+3rem)] max-md:rounded-none max-md:border-x-0"
            >
              <p className="text-center text-sm text-white/70 font-medium">
                What matters to you in governance?
              </p>

              <PillCloud
                pills={topicPills.map((t) => ({
                  id: t.id,
                  text: t.trending ? `${t.text}` : t.text,
                  icon: t.trending ? <TrendingUp className="h-3 w-3 text-orange-400" /> : undefined,
                }))}
                selected={selectedTopics}
                onToggle={handleTopicToggle}
                multiSelect
                layout="cloud"
                size="md"
              />

              <div className="relative">
                <input
                  type="text"
                  value={freeformText}
                  onChange={(e) => setFreeformText(e.target.value)}
                  onKeyDown={handleFreeformKeyDown}
                  placeholder={ghostText}
                  className={cn(
                    'w-full rounded-lg border border-white/[0.12] bg-white/[0.07] px-4 py-3',
                    'text-sm text-white placeholder:text-white/40',
                    'backdrop-blur-sm transition-colors',
                    'focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20',
                  )}
                />
                {freeformText.trim().length >= 10 && (
                  <button
                    onClick={() => handleInitialInteraction()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary/20 p-1.5 text-primary transition-colors hover:bg-primary/30"
                    aria-label="Start matching"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Fast-track link */}
              <button
                onClick={() => setShowFastTrack(true)}
                className="block mx-auto text-xs text-primary/70 hover:text-primary transition-colors"
              >
                Or express yourself freely &rarr;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading && !showFastTrack && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting...
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-center text-sm text-destructive">{error}</p>
            <button
              onClick={handleReset}
              className="text-xs text-primary/70 hover:text-primary transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ─── Render: Matching state ───────────────────────────── */

  if (flowState === 'matching') {
    return (
      <div className="w-full space-y-3 max-md:rounded-t-2xl max-md:bg-black/50 max-md:backdrop-blur-xl max-md:px-4 max-md:pb-[calc(env(safe-area-inset-bottom,8px)+56px)] max-md:pt-4 max-md:border-t max-md:border-white/[0.08] max-md:-mx-6 max-md:w-[calc(100%+3rem)]">
        <AnimatePresence mode="wait">
          {/* Waiting for first question */}
          {isLoading && !question && (
            <motion.div
              key="loading"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-6"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Preparing your questions...</p>
            </motion.div>
          )}

          {/* Active question */}
          {question && (
            <motion.div
              key={`round-${round}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
            >
              <ConversationalRound
                question={{
                  id: `round-${round}`,
                  text: question.question,
                  options: question.options,
                }}
                roundNumber={round}
                onAnswer={handleAnswer}
                isLoading={isLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thin confidence bar */}
        {confidence > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(confidence, 100)}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
              {confidence}% match confidence
            </span>
          </div>
        )}

        {/* Loading matches indicator (replaces old "ready" state) */}
        {status === 'ready_to_match' && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Finding your matches...
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-center text-sm text-destructive">{error}</p>
            <button
              onClick={handleReset}
              className="text-xs text-primary/70 hover:text-primary transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ─── Render: Results state ────────────────────────────── */

  return (
    <div className="w-full space-y-6">
      {personalityLabel && identityColor && userAlignments && matches ? (
        <MatchResults
          personalityLabel={personalityLabel}
          identityColor={identityColor}
          userAlignments={userAlignments}
          matches={matches}
          spoMatches={spoMatches}
          onReset={handleReset}
          globeRef={globeRef}
        />
      ) : (
        <>
          {error && (
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-center text-sm text-destructive">{error}</p>
              <button
                onClick={handleReset}
                className="text-xs text-primary/70 hover:text-primary transition-colors"
              >
                Try again
              </button>
            </div>
          )}
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Start over
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
