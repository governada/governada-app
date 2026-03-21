'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PillCloud } from './PillCloud';
import { ConfidenceRing } from './ConfidenceRing';
import { ConversationalRound } from './ConversationalRound';
import { SemanticFastTrack } from './SemanticFastTrack';
import { MatchResults } from './MatchResults';
import { useConversationalMatch } from '@/hooks/useConversationalMatch';
import { saveConversationalProfile } from '@/lib/matchStore';
import { cn } from '@/lib/utils';
import type { ConstellationRef } from '@/components/GovernanceConstellation';

/* ─── Types ─────────────────────────────────────────────── */

type FlowState = 'idle' | 'matching' | 'ready' | 'results';

interface ConversationalMatchFlowProps {
  globeRef: React.RefObject<ConstellationRef | null>;
  onMatchStart?: () => void;
  onMatchComplete?: (matches: unknown[]) => void;
}

/* ─── Initial topic pills ───────────────────────────────── */

const INITIAL_TOPICS = [
  { id: 'topic-treasury', text: 'Treasury' },
  { id: 'topic-innovation', text: 'Innovation' },
  { id: 'topic-security', text: 'Security' },
  { id: 'topic-transparency', text: 'Transparency' },
  { id: 'topic-decentralization', text: 'Decentralization' },
  { id: 'topic-developer-funding', text: 'Developer Funding' },
  { id: 'topic-community-growth', text: 'Community Growth' },
  { id: 'topic-constitutional', text: 'Constitutional Compliance' },
] as const;

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

/* ─── Globe threshold by round ──────────────────────────── */

function getThresholdForRound(round: number): number {
  switch (round) {
    case 1:
      return 180;
    case 2:
      return 120;
    case 3:
      return 80;
    default:
      return 50;
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
}: ConversationalMatchFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [freeformText, setFreeformText] = useState('');
  const [showFastTrack, setShowFastTrack] = useState(false);
  const [pendingSemanticText, setPendingSemanticText] = useState<string | null>(null);
  const hasStartedRef = useRef(false);
  const ghostText = useGhostText();

  const {
    round,
    question,
    status,
    preview,
    matches,
    userAlignments,
    personalityLabel,
    identityColor,
    confidence,
    isLoading,
    error,
    startSession,
    submitAnswer,
    getMatches,
    reset,
  } = useConversationalMatch();

  /* ─── URL popstate handler ─────────────────────────────── */

  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      if (e.state?.state === 'matching') {
        // Allow back to matching state — but we don't auto-restart
      } else if (flowState === 'matching' || flowState === 'ready') {
        // Back button during matching → reset to idle
        handleReset();
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowState]);

  /* ─── Sync hook status → flow state ────────────────────── */

  useEffect(() => {
    if (status === 'ready_to_match' && flowState === 'matching') {
      // Don't auto-transition — let the user click "See your matches"
    }
    if (status === 'matched' && flowState !== 'results') {
      setFlowState('results');
      pushUrlState('results', 'results');
      if (matches) {
        onMatchComplete?.(matches);
        // Persist conversational profile for later use
        if (personalityLabel && identityColor && userAlignments) {
          saveConversationalProfile({
            personalityLabel,
            identityColor,
            alignments: userAlignments,
            matchResults: matches,
            timestamp: Date.now(),
          });
        }
      }
    }
  }, [
    status,
    flowState,
    matches,
    personalityLabel,
    identityColor,
    userAlignments,
    onMatchComplete,
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

  const handleInitialInteraction = useCallback(async () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    onMatchStart?.();
    setFlowState('matching');
    pushUrlState('matching', 'matching');

    await startSession();
  }, [onMatchStart, startSession]);

  /* ─── Topic pill toggle ────────────────────────────────── */

  const handleTopicToggle = useCallback(
    (id: string) => {
      setSelectedTopics((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });

      // Auto-start on first pill tap
      if (!hasStartedRef.current) {
        handleInitialInteraction();
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

      // Start the session — the pill flow still runs, but the semantic text
      // will be threaded through as rawText on the first round answer
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        onMatchStart?.();
        setFlowState('matching');
        pushUrlState('matching', 'matching');
        await startSession();
      }
    },
    [onMatchStart, startSession],
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

      submitAnswer(selectedIds, combinedText || undefined);
    },
    [submitAnswer, pendingSemanticText],
  );

  /* ─── See matches CTA ──────────────────────────────────── */

  const handleSeeMatches = useCallback(async () => {
    setFlowState('ready');
    await getMatches();
  }, [getMatches]);

  /* ─── Reset ────────────────────────────────────────────── */

  const handleReset = useCallback(() => {
    reset();
    setFlowState('idle');
    setSelectedTopics(new Set());
    setFreeformText('');
    setShowFastTrack(false);
    setPendingSemanticText(null);
    hasStartedRef.current = false;
    globeRef.current?.clearMatches();
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  }, [reset, globeRef]);

  /* ─── Render: Idle state ───────────────────────────────── */

  if (flowState === 'idle') {
    return (
      <div className="w-full space-y-4">
        <AnimatePresence mode="wait">
          {showFastTrack ? (
            <motion.div
              key="fast-track"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <p className="text-center text-sm text-muted-foreground">Express yourself freely</p>

              <SemanticFastTrack onSubmit={handleSemanticSubmit} isProcessing={isLoading} />

              <button
                onClick={() => setShowFastTrack(false)}
                className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Back to topic pills
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="pills"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <p className="text-center text-sm text-muted-foreground">
                What matters to you in governance?
              </p>

              <PillCloud
                pills={INITIAL_TOPICS.map((t) => ({ id: t.id, text: t.text }))}
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
                    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3',
                    'text-sm text-foreground placeholder:text-muted-foreground/50',
                    'backdrop-blur-sm transition-colors',
                    'focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20',
                  )}
                />
                {freeformText.trim().length >= 10 && (
                  <button
                    onClick={handleInitialInteraction}
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
                className="block mx-auto text-xs text-primary/80 hover:text-primary transition-colors"
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

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  /* ─── Render: Matching state ───────────────────────────── */

  if (flowState === 'matching') {
    return (
      <div className="w-full space-y-4">
        <AnimatePresence mode="wait">
          {/* Waiting for first question */}
          {isLoading && !question && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
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

        {/* Confidence + ready CTA */}
        <div className="flex items-center justify-between">
          <ConfidenceRing confidence={confidence} size={48} label="Match confidence" />

          {status === 'ready_to_match' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Button
                onClick={handleSeeMatches}
                size="lg"
                className="gap-2 rounded-xl font-semibold"
              >
                <Sparkles className="h-4 w-4" />
                See your matches
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  /* ─── Render: Ready state (loading matches) ────────────── */

  if (flowState === 'ready') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <ConfidenceRing confidence={confidence} size={80} />
        </motion.div>
        <p className="text-sm text-muted-foreground">Finding your matches...</p>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
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
          onReset={handleReset}
          globeRef={globeRef}
        />
      ) : (
        <>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
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
