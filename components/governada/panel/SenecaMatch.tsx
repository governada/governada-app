'use client';

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Compass, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { buildAlignmentFromAnswers } from '@/lib/matching/answerVectors';
import { alignmentsToArray } from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';
import type { QuickMatchResponse, MatchResult } from '@/hooks/useQuickMatch';
import { MatchResultOverlay } from '@/components/governada/MatchResultOverlay';
import {
  buildMatchStartSequence,
  buildAnswerSequence,
  buildRevealSequence,
  buildMatchCleanupSequence,
  getRevealDurationMs,
} from '@/lib/globe/matchChoreography';
import posthog from 'posthog-js';

/* ─── Question definitions ─── */

interface QuestionDef {
  id: string;
  senecaPrompt: string;
  options: Array<{
    value: string;
    label: string;
    brief: string;
  }>;
}

const MATCH_QUESTIONS: QuestionDef[] = [
  {
    id: 'treasury',
    senecaPrompt:
      'Let\u2019s start with the treasury \u2014 Cardano holds billions of ADA for ecosystem funding. How should it be spent?',
    options: [
      { value: 'conservative', label: 'Protect it', brief: 'Fund only proven, essential projects' },
      { value: 'growth', label: 'Invest boldly', brief: 'Rapid ecosystem expansion' },
      { value: 'balanced', label: 'Case by case', brief: 'Evaluate each proposal on merits' },
    ],
  },
  {
    id: 'protocol',
    senecaPrompt:
      'Good. Now, protocol upgrades shape Cardano\u2019s technical future. What\u2019s your instinct?',
    options: [
      { value: 'caution', label: 'Stability first', brief: 'Move carefully and deliberately' },
      { value: 'innovation', label: 'Push forward', brief: 'Evolve rapidly to compete' },
      { value: 'case_by_case', label: 'Depends', brief: 'Assess each change on its risks' },
    ],
  },
  {
    id: 'transparency',
    senecaPrompt: 'Should your governance representatives explain every vote publicly?',
    options: [
      { value: 'essential', label: 'Non-negotiable', brief: 'Every vote must be explained' },
      { value: 'nice_to_have', label: 'When possible', brief: 'Helpful but not required' },
      { value: 'doesnt_matter', label: 'Results matter', brief: 'Let votes speak for themselves' },
    ],
  },
  {
    id: 'decentralization',
    senecaPrompt: 'Last one. How should governance power be distributed across the network?',
    options: [
      { value: 'spread_widely', label: 'Spread widely', brief: 'No single entity should dominate' },
      {
        value: 'concentrated',
        label: 'Merit-based',
        brief: 'Concentrate among qualified participants',
      },
      { value: 'current_fine', label: 'It\u2019s fine', brief: 'Current distribution works' },
    ],
  },
];

const TOTAL_QUESTIONS = MATCH_QUESTIONS.length;

/** Progressive narrowing — top N closest DReps per round (used in reduced-motion fallback) */
const TOP_N_PER_ROUND = [200, 50, 10, 5];

/* ─── Seneca acknowledgement messages (evocative, matching globe visual) ─── */

const ACKNOWLEDGEMENTS = [
  'The field is shifting. I can see clusters forming around your priorities\u2026',
  'Narrowing in. A pattern is emerging among the representatives\u2026',
  'Almost there. I see a clear cluster of aligned representatives\u2026',
  'Locking on to your best matches\u2026',
];

/* ─── Globe command bridge via CustomEvent ─── */

function dispatchGlobeCommand(cmd: GlobeCommand) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('senecaGlobeCommand', { detail: cmd }));
  }
}

/* ─── Types ─── */

interface SenecaMatchProps {
  onBack: () => void;
  onGlobeCommand?: (cmd: GlobeCommand) => void;
}

type MatchStep = 'intro' | number | 'loading' | 'revealing' | 'results' | 'error';

/* ─── Answer label lookup ─── */

function getAnswerLabel(questionId: string, value: string): string {
  const q = MATCH_QUESTIONS.find((q) => q.id === questionId);
  return q?.options.find((o) => o.value === value)?.label ?? value;
}

/* ─── Component ─── */

export function SenecaMatch({ onBack, onGlobeCommand }: SenecaMatchProps) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<MatchStep>('intro');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuickMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setExpandedMatch] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Overlay state for celebratory #1 match card (rendered via portal)
  const [overlayState, setOverlayState] = useState<{
    focusedMatch: MatchResult;
    focusedRank: number;
    isTopMatch: boolean;
  } | null>(null);

  // Track the last alignment vector for reveal sequence
  const lastAlignmentRef = useRef<number[]>([50, 50, 50, 50, 50, 50]);

  // Clean up timers on unmount or restart
  const clearPendingTimers = useCallback(() => {
    for (const id of pendingTimersRef.current) clearTimeout(id);
    pendingTimersRef.current.clear();
  }, []);

  useEffect(() => clearPendingTimers, [clearPendingTimers]);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current.delete(id);
      fn();
    }, ms);
    pendingTimersRef.current.add(id);
    return id;
  }, []);

  const sendGlobeCommand = useCallback(
    (cmd: GlobeCommand) => {
      onGlobeCommand?.(cmd);
      dispatchGlobeCommand(cmd);
    },
    [onGlobeCommand],
  );

  // Start the quiz — "entering Cerebro": choreographed sequence
  const handleStart = useCallback(() => {
    setStep(0);
    if (prefersReducedMotion) {
      sendGlobeCommand({ type: 'matchStart' });
    } else {
      sendGlobeCommand(buildMatchStartSequence());
    }
    posthog.capture('match_started', { source: 'seneca_panel' });
    posthog.capture('match_cerebro_entered');
  }, [sendGlobeCommand, prefersReducedMotion]);

  // Handle answer selection
  const handleAnswer = useCallback(
    (questionId: string, value: string, questionIndex: number) => {
      const newAnswers = { ...answers, [questionId]: value };
      setAnswers(newAnswers);

      posthog.capture('match_answer_selected', {
        round: questionIndex + 1,
        question_id: questionId,
        answer: value,
      });

      // Build alignment vector and dispatch choreographed sequence
      const alignment = buildAlignmentFromAnswers(newAnswers);
      const vector = alignmentsToArray(alignment);
      const topN = TOP_N_PER_ROUND[questionIndex] ?? 5;
      lastAlignmentRef.current = vector;

      posthog.capture('match_narrowing_round', {
        round: questionIndex + 1,
        remaining_count: topN,
      });

      if (prefersReducedMotion) {
        // Simplified: direct highlight without scan/dive theatrics
        sendGlobeCommand({
          type: 'highlight',
          alignment: vector,
          threshold: 9999,
          drepOnly: true,
          zoomToCluster: true,
          topN,
          scanProgressOverride: [0.15, 0.4, 0.7, 0.95][questionIndex] ?? 0.95,
        });
      } else {
        sendGlobeCommand(buildAnswerSequence(questionIndex, vector, 0));
      }

      // Advance to next question or submit — snappy transitions
      if (questionIndex < TOTAL_QUESTIONS - 1) {
        scheduleTimer(() => setStep(questionIndex + 1), 350);
      } else {
        scheduleTimer(() => {
          setStep('loading');
          submitMatch(newAnswers);
        }, 400);
      }
    },
    [answers, sendGlobeCommand, prefersReducedMotion, scheduleTimer], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Submit answers to API
  const submitMatch = useCallback(
    async (finalAnswers: Record<string, string>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/governance/quick-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            treasury: finalAnswers.treasury,
            protocol: finalAnswers.protocol,
            transparency: finalAnswers.transparency,
            decentralization: finalAnswers.decentralization,
            match_type: 'drep',
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data = (await res.json()) as QuickMatchResponse;
        setResult(data);

        posthog.capture('match_completed', {
          top_match_score: data.matches[0]?.matchScore ?? 0,
          match_count: data.matches.length,
        });

        if (data.matches.length > 0) {
          const topMatches = data.matches.slice(0, 5).map((m) => ({ nodeId: m.drepId }));

          if (prefersReducedMotion) {
            // Skip countdown — go straight to results
            setStep('results');
            sendGlobeCommand({ type: 'matchFlyTo', nodeId: data.matches[0].drepId });
            scheduleTimer(() => {
              setOverlayState({
                focusedMatch: data.matches[0],
                focusedRank: 1,
                isTopMatch: true,
              });
            }, 1500);
          } else {
            // Theatrical reveal: countdown 5→1 then fly to #1
            setStep('revealing');
            posthog.capture('match_countdown_viewed');

            sendGlobeCommand(buildRevealSequence(topMatches, lastAlignmentRef.current, 0));

            // Sync overlay to appear after the full reveal sequence completes
            const revealDuration = getRevealDurationMs(topMatches.length);
            scheduleTimer(() => {
              setStep('results');
              setOverlayState({
                focusedMatch: data.matches[0],
                focusedRank: 1,
                isTopMatch: true,
              });
              posthog.capture('match_reveal_completed', {
                match_count: topMatches.length,
                top_match_score: data.matches[0]?.matchScore ?? 0,
              });
            }, revealDuration);
          }
        } else {
          setStep('results');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setStep('error');
      }
    },
    [sendGlobeCommand, prefersReducedMotion, scheduleTimer],
  );

  // Restart the quiz
  const handleRestart = useCallback(() => {
    clearPendingTimers();
    setAnswers({});
    setResult(null);
    setError(null);
    setExpandedMatch(null);
    setOverlayState(null);
    setStep('intro');
    if (prefersReducedMotion) {
      sendGlobeCommand({ type: 'clear' });
      sendGlobeCommand({ type: 'reset' });
    } else {
      sendGlobeCommand(buildMatchCleanupSequence());
    }
    posthog.capture('match_restarted');
  }, [sendGlobeCommand, clearPendingTimers, prefersReducedMotion]);

  // Current question index
  const currentQIndex = typeof step === 'number' ? step : -1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/10 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'h-6 w-6 flex items-center justify-center rounded-md',
            'text-muted-foreground/60 hover:text-foreground hover:bg-accent/30',
            'transition-colors',
          )}
          aria-label="Back to briefing"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary/70" />
          <span className="text-xs font-semibold text-foreground/80">Find Your Match</span>
        </div>
        {/* Progress indicator — visible during questions, loading, and revealing */}
        {(typeof step === 'number' || step === 'loading' || step === 'revealing') && (
          <div className="ml-auto flex items-center gap-1">
            {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i < (step === 'loading' || step === 'revealing' ? TOTAL_QUESTIONS : currentQIndex)
                    ? 'w-4 bg-primary'
                    : i === currentQIndex
                      ? 'w-4 bg-primary/60'
                      : 'w-2 bg-white/10',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Single-card content area — no scroll, AnimatePresence between steps */}
      <div className="flex-1 flex flex-col px-3 py-3 min-h-0">
        {/* Past answer pills — compact strip above current question */}
        {currentQIndex > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
            {MATCH_QUESTIONS.slice(0, currentQIndex).map((q) => {
              const answer = answers[q.id];
              if (!answer) return null;
              return (
                <span
                  key={q.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/15 text-primary/80 border border-primary/20"
                >
                  {getAnswerLabel(q.id, answer)}
                </span>
              );
            })}
          </div>
        )}

        {/* Loading/revealing/results past answers strip */}
        {(step === 'loading' || step === 'revealing' || step === 'results' || step === 'error') &&
          Object.keys(answers).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
              {MATCH_QUESTIONS.map((q) => {
                const answer = answers[q.id];
                if (!answer) return null;
                return (
                  <span
                    key={q.id}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/15 text-primary/80 border border-primary/20"
                  >
                    {getAnswerLabel(q.id, answer)}
                  </span>
                );
              })}
            </div>
          )}

        <AnimatePresence mode="popLayout">
          {/* Intro */}
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              className="flex flex-col flex-1 justify-center gap-4"
            >
              <SenecaBubble>
                I&apos;ll help you find a governance representative who shares your priorities. Four
                quick questions &mdash; each one narrows the field on the globe.
              </SenecaBubble>
              <button
                onClick={handleStart}
                className={cn(
                  'w-full rounded-xl border border-primary/30 bg-primary/10',
                  'hover:bg-primary/20 px-4 py-3 text-sm font-medium text-primary',
                  'transition-colors text-center min-h-[44px]',
                )}
              >
                Let&apos;s find my match
              </button>
            </motion.div>
          )}

          {/* Question card — single card, no stacking */}
          {typeof step === 'number' && MATCH_QUESTIONS[step] && (
            <motion.div
              key={`q-${step}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="flex flex-col flex-1 gap-3"
            >
              <SenecaBubble>{MATCH_QUESTIONS[step].senecaPrompt}</SenecaBubble>

              <div className="space-y-1.5">
                {MATCH_QUESTIONS[step].options.map((opt, i) => (
                  <motion.button
                    key={opt.value}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.2 }}
                    onClick={() => handleAnswer(MATCH_QUESTIONS[step].id, opt.value, step)}
                    className={cn(
                      'w-full rounded-xl border px-4 py-2.5 text-left transition-all min-h-[44px]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer',
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{opt.brief}</span>
                  </motion.button>
                ))}
              </div>

              {/* Acknowledgement from previous round fades in at top */}
              {step > 0 && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <SenecaBubble>{ACKNOWLEDGEMENTS[step - 1]}</SenecaBubble>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Loading — waiting for API */}
          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              className="flex flex-col flex-1 items-center justify-center gap-3"
            >
              <SenecaBubble>{ACKNOWLEDGEMENTS[TOTAL_QUESTIONS - 1]}</SenecaBubble>
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
                <span className="text-xs text-muted-foreground">
                  Scanning the constellation for your matches...
                </span>
              </div>
            </motion.div>
          )}

          {/* Revealing — countdown sequence playing on the globe */}
          {step === 'revealing' && (
            <motion.div
              key="revealing"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              className="flex flex-col flex-1 items-center justify-center gap-3"
            >
              <SenecaBubble>
                I&apos;ve found your matches. Watch the constellation&hellip;
              </SenecaBubble>
              <div className="flex items-center gap-2 py-4">
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-2 w-2 rounded-full bg-primary"
                />
                <span className="text-xs text-muted-foreground">Revealing your matches...</span>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1 justify-center gap-3"
            >
              <SenecaBubble>
                Something went wrong while computing your matches. {error ? `(${error})` : ''} Want
                to try again?
              </SenecaBubble>
              <button
                onClick={handleRestart}
                className={cn(
                  'w-full rounded-xl border border-white/10 bg-white/5',
                  'hover:bg-white/10 px-4 py-2.5 text-sm text-foreground',
                  'transition-colors min-h-[44px]',
                )}
              >
                Start over
              </button>
            </motion.div>
          )}

          {/* Results */}
          {step === 'results' && result && (
            <motion.div
              key="results"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="flex flex-col flex-1 min-h-0 gap-2"
            >
              <MatchResults
                result={result}
                onExpandMatch={setExpandedMatch}
                onGlobeCommand={sendGlobeCommand}
                onRestart={handleRestart}
                onFocusOverlay={(match, rank) =>
                  setOverlayState({ focusedMatch: match, focusedRank: rank, isTopMatch: false })
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Celebratory match overlay — rendered via portal to escape panel bounds */}
      {overlayState &&
        result &&
        typeof document !== 'undefined' &&
        createPortal(
          <MatchResultOverlay
            result={result}
            focusedMatch={overlayState.focusedMatch}
            focusedRank={overlayState.focusedRank}
            isTopMatch={overlayState.isTopMatch}
            onBackToTop={() => {
              const topMatch = result.matches[0];
              if (topMatch) {
                sendGlobeCommand({ type: 'matchFlyTo', nodeId: topMatch.drepId });
                scheduleTimer(() => {
                  setOverlayState({ focusedMatch: topMatch, focusedRank: 1, isTopMatch: true });
                }, 1500);
              }
            }}
            onDismiss={() => setOverlayState(null)}
          />,
          document.body,
        )}
    </div>
  );
}

/* ─── Seneca message bubble ─── */

function SenecaBubble({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex gap-2 items-start"
    >
      <div className="shrink-0 mt-0.5">
        <Compass className="h-3.5 w-3.5 text-primary/60" />
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed">{children}</p>
    </motion.div>
  );
}

/* ─── Match results section ─── */

interface MatchResultsProps {
  result: QuickMatchResponse;
  onExpandMatch: (id: string | null) => void;
  onGlobeCommand: (cmd: GlobeCommand) => void;
  onRestart: () => void;
  onFocusOverlay: (match: MatchResult, rank: number) => void;
}

function MatchResults({
  result,
  onExpandMatch,
  onGlobeCommand,
  onRestart,
  onFocusOverlay,
}: MatchResultsProps) {
  // Focus a different match — fly globe + show overlay after flyTo settles (snappy 800ms)
  const handleFocusMatch = useCallback(
    (match: MatchResult, rank: number) => {
      onExpandMatch(match.drepId);
      onGlobeCommand({ type: 'matchFlyTo', nodeId: match.drepId });
      posthog.capture('match_result_expanded', { drep_id: match.drepId, rank });
      setTimeout(() => onFocusOverlay(match, rank), 800);
    },
    [onExpandMatch, onGlobeCommand, onFocusOverlay],
  );

  return (
    <>
      {/* Seneca message */}
      <div className="shrink-0">
        <SenecaBubble>
          Your #1 match is on the globe. Here are your other top matches &mdash; tap any to explore.
        </SenecaBubble>
      </div>

      {/* Remaining match cards (#2-5) — #1 is shown in the overlay */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium px-1">Other matches</p>
        {result.matches.slice(1, 5).map((match, idx) => (
          <CompactMatchCard
            key={match.drepId}
            match={match}
            rank={idx + 2}
            expanded={false}
            onExpand={() => handleFocusMatch(match, idx + 2)}
            userAlignments={result.userAlignments}
          />
        ))}
      </div>

      {/* Actions — always anchored at bottom */}
      <div className="shrink-0 pt-1">
        <button
          onClick={onRestart}
          className={cn(
            'w-full rounded-xl border border-white/10 bg-white/5',
            'hover:bg-white/10 px-4 py-2 text-xs text-muted-foreground',
            'transition-colors min-h-[36px]',
          )}
        >
          Try different answers
        </button>
      </div>
    </>
  );
}

/* ─── Compact match card for panel width ─── */

interface CompactMatchCardProps {
  match: MatchResult;
  rank: number;
  expanded: boolean;
  onExpand: () => void;
  userAlignments: AlignmentScores;
}

function CompactMatchCard({
  match,
  rank,
  expanded,
  onExpand,
  userAlignments,
}: CompactMatchCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayName = match.drepName || match.drepId.slice(0, 16) + '\u2026';
  const scorePercent = Math.round(match.matchScore);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: rank * 0.15,
        type: 'spring',
        stiffness: 300,
        damping: 28,
      }}
      className={cn(
        'rounded-xl border bg-card/40 backdrop-blur-sm overflow-hidden transition-colors',
        'border-white/[0.08]',
      )}
    >
      {/* Collapsed row */}
      <button
        onClick={onExpand}
        className="w-full text-left px-3 py-2 min-h-[40px]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: match.identityColor }}
          >
            {rank}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm text-foreground truncate block">
              {displayName}
            </span>
            {match.tier && <span className="text-[10px] text-muted-foreground">{match.tier}</span>}
          </div>
          <span
            className="font-display text-lg font-bold tabular-nums shrink-0"
            style={{ color: match.identityColor }}
          >
            {scorePercent}%
          </span>
        </div>

        {(match.agreeDimensions.length > 0 || match.differDimensions.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-1 ml-7">
            {match.agreeDimensions.slice(0, 2).map((d) => (
              <span
                key={d}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-green-500/10 text-green-400"
              >
                {d} ✓
              </span>
            ))}
            {match.differDimensions.slice(0, 1).map((d) => (
              <span
                key={d}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-muted/30 text-muted-foreground"
              >
                {d} ✗
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeInOut' }
            }
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-white/[0.06] pt-3">
              <DimensionBars userAlignments={userAlignments} matchAlignments={match.alignments} />
              {match.signatureInsight && (
                <p className="text-xs text-muted-foreground italic">{match.signatureInsight}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1 gap-1.5 h-9 text-xs">
                  <Link href={`/drep/${encodeURIComponent(match.drepId)}`}>
                    View profile
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Dimension agreement bars ─── */

const DIMENSION_LABELS: Record<string, string> = {
  treasuryConservative: 'Fiscal',
  treasuryGrowth: 'Growth',
  decentralization: 'Decentr.',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transp.',
};

const DIMENSION_ORDER = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
] as const;

function DimensionBars({
  userAlignments,
  matchAlignments,
}: {
  userAlignments: AlignmentScores;
  matchAlignments: AlignmentScores;
}) {
  return (
    <div className="space-y-1">
      {DIMENSION_ORDER.map((dim) => {
        const userVal = userAlignments[dim] ?? 50;
        const matchVal = matchAlignments[dim] ?? 50;
        const agreement = Math.round(100 - Math.abs(userVal - matchVal));
        const status = agreement >= 70 ? 'agree' : agreement < 40 ? 'differ' : 'neutral';

        return (
          <div key={dim} className="flex items-center gap-1.5 text-[10px]">
            <span
              className={cn(
                'w-14 shrink-0 truncate',
                status === 'agree'
                  ? 'text-green-400'
                  : status === 'differ'
                    ? 'text-amber-400'
                    : 'text-muted-foreground',
              )}
            >
              {DIMENSION_LABELS[dim] ?? dim}
            </span>
            <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  status === 'agree'
                    ? 'bg-green-500'
                    : status === 'differ'
                      ? 'bg-amber-500'
                      : 'bg-muted-foreground/40',
                )}
                style={{ width: `${agreement}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-muted-foreground">{agreement}%</span>
          </div>
        );
      })}
    </div>
  );
}
