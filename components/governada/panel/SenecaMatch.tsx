'use client';

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Compass, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { buildAlignmentFromAnswers } from '@/lib/matching/answerVectors';
import { getDominantDimension, getIdentityColor, alignmentsToArray } from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';
import type { QuickMatchResponse, MatchResult } from '@/hooks/useQuickMatch';
import {
  buildMatchStartSequence,
  buildAnswerSequence,
  buildRevealSequence,
  buildMatchCleanupSequence,
} from '@/lib/globe/matchChoreography';

/* ─── Question definitions (mirrored from QuickMatchFlow) ─── */

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

/** Progressive threshold narrowing: each answer tightens the globe filter */
const THRESHOLDS = [160, 100, 60, 35];

/* ─── Seneca acknowledgement messages ─── */

const ACKNOWLEDGEMENTS = [
  'Interesting. That tells me a lot about your priorities.',
  'Got it. Let me narrow the field...',
  'Clear signal. One more dimension to map.',
  'Perfect. I have a clear picture now. Computing your matches...',
];

/* ─── Globe command bridge via CustomEvent ─── */

/**
 * Dispatch a globe command as a CustomEvent so the AnonymousLanding
 * (which owns the globe ref) can execute it. This avoids threading
 * the globe ref through the shell → panel → match component chain.
 */
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

type MatchStep = 'intro' | number | 'loading' | 'results' | 'error';

/* ─── Component ─── */

export function SenecaMatch({ onBack, onGlobeCommand }: SenecaMatchProps) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<MatchStep>('intro');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuickMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Send globe command via prop callback + CustomEvent bridge
  const sendGlobeCommand = useCallback(
    (cmd: GlobeCommand) => {
      onGlobeCommand?.(cmd);
      dispatchGlobeCommand(cmd);
    },
    [onGlobeCommand],
  );

  // Computed alignment from current answers (builds incrementally)
  // Auto-scroll to bottom when step changes — double-rAF ensures DOM has updated
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    });
  }, [step]);

  // Start the quiz with theatrical opening
  const handleStart = useCallback(() => {
    setStep(0);
    sendGlobeCommand(buildMatchStartSequence());
  }, [sendGlobeCommand]);

  // Handle answer selection
  const handleAnswer = useCallback(
    (questionId: string, value: string, questionIndex: number) => {
      const newAnswers = { ...answers, [questionId]: value };
      setAnswers(newAnswers);

      // Theatrical choreography for this answer round
      const alignment = buildAlignmentFromAnswers(newAnswers);
      const vector = alignmentsToArray(alignment);
      const threshold = THRESHOLDS[questionIndex] ?? 35;
      sendGlobeCommand(buildAnswerSequence(questionIndex, vector, threshold));

      // Advance to next question or submit
      if (questionIndex < TOTAL_QUESTIONS - 1) {
        setTimeout(() => setStep(questionIndex + 1), 600);
      } else {
        setTimeout(() => {
          setStep('loading');
          submitMatch(newAnswers);
        }, 800);
      }
    },
    [answers, sendGlobeCommand], // eslint-disable-line react-hooks/exhaustive-deps
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
        setStep('results');

        // Theatrical reveal: countdown 5→4→3→2→1, camera sweeps to #1
        if (data.matches.length > 0) {
          const alignment = buildAlignmentFromAnswers(finalAnswers);
          const vector = alignmentsToArray(alignment);
          sendGlobeCommand(
            buildRevealSequence(
              data.matches.slice(0, 5).map((m) => ({ nodeId: m.drepId })),
              vector,
              35,
            ),
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setStep('error');
      }
    },
    [sendGlobeCommand],
  );

  // Restart the quiz
  const handleRestart = useCallback(() => {
    setAnswers({});
    setResult(null);
    setError(null);
    setExpandedMatch(null);
    setStep('intro');
    sendGlobeCommand(buildMatchCleanupSequence());
  }, [sendGlobeCommand]);

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
        {/* Progress indicator */}
        {typeof step === 'number' && (
          <div className="ml-auto flex items-center gap-1">
            {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i < step
                    ? 'w-4 bg-primary'
                    : i === step
                      ? 'w-4 bg-primary/60'
                      : 'w-2 bg-white/10',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scrollable conversation area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent px-3 py-3 space-y-3"
      >
        {/* Intro message */}
        <SenecaBubble delay={0}>
          I&apos;ll help you find a governance representative who shares your priorities. Four quick
          questions &mdash; each one narrows the field on the globe.
        </SenecaBubble>

        {step === 'intro' && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
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

        {/* Questions */}
        {MATCH_QUESTIONS.map((q, qIndex) => {
          if (
            typeof step !== 'number' &&
            step !== 'loading' &&
            step !== 'results' &&
            step !== 'error'
          )
            return null;
          const stepNum =
            step === 'loading' || step === 'results' || step === 'error' ? TOTAL_QUESTIONS : step;
          if (qIndex > stepNum) return null;

          const selectedValue = answers[q.id];
          const isAnswered = Boolean(selectedValue);
          const isCurrent = typeof step === 'number' && step === qIndex;

          return (
            <div key={q.id} className="space-y-2">
              <SenecaBubble delay={isCurrent ? 0.2 : 0}>{q.senecaPrompt}</SenecaBubble>

              {/* Answer pills */}
              <div className="space-y-1.5 pl-2">
                {q.options.map((opt) => {
                  const isSelected = selectedValue === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      initial={prefersReducedMotion || !isCurrent ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: isAnswered && !isSelected ? 0.4 : 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => {
                        if (!isAnswered) {
                          handleAnswer(q.id, opt.value, qIndex);
                        }
                      }}
                      disabled={isAnswered}
                      className={cn(
                        'w-full rounded-xl border px-4 py-2.5 text-left transition-all min-h-[44px]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isSelected
                          ? 'bg-primary/20 border-primary/30'
                          : 'border-white/10 bg-white/5 hover:bg-white/10',
                        isAnswered && !isSelected && 'opacity-40 cursor-default',
                        !isAnswered && 'cursor-pointer',
                      )}
                      aria-pressed={isSelected}
                    >
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {opt.brief}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Seneca acknowledgement after answer */}
              {isAnswered && qIndex < TOTAL_QUESTIONS - 1 && (
                <SenecaBubble delay={0.3}>{ACKNOWLEDGEMENTS[qIndex]}</SenecaBubble>
              )}
            </div>
          );
        })}

        {/* Loading state */}
        {step === 'loading' && (
          <div className="space-y-2">
            <SenecaBubble delay={0.2}>{ACKNOWLEDGEMENTS[TOTAL_QUESTIONS - 1]}</SenecaBubble>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-3 py-4"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
              <span className="text-xs text-muted-foreground">
                Analyzing the governance landscape...
              </span>
            </motion.div>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="space-y-2">
            <SenecaBubble delay={0}>
              Something went wrong while computing your matches. {error ? `(${error})` : ''} Want to
              try again?
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
          </div>
        )}

        {/* Results */}
        {step === 'results' && result && (
          <MatchResults
            result={result}
            expandedMatch={expandedMatch}
            onExpandMatch={setExpandedMatch}
            onGlobeCommand={sendGlobeCommand}
            onRestart={handleRestart}
          />
        )}
      </div>
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
  expandedMatch: string | null;
  onExpandMatch: (id: string | null) => void;
  onGlobeCommand: (cmd: GlobeCommand) => void;
  onRestart: () => void;
}

function MatchResults({
  result,
  expandedMatch,
  onExpandMatch,
  onGlobeCommand,
  onRestart,
}: MatchResultsProps) {
  const prefersReducedMotion = useReducedMotion();
  const dominant = getDominantDimension(result.userAlignments);
  const _identityColor = getIdentityColor(dominant).hex;

  return (
    <div className="space-y-3">
      {/* Identity reveal */}
      <SenecaBubble delay={0}>
        Based on your answers, you&apos;re a{' '}
        <strong style={{ color: result.identityColor }}>{result.personalityLabel}</strong>. Here are
        the representatives who best align with your priorities.
      </SenecaBubble>

      {/* Compact identity card */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 28 }}
        className="rounded-xl border p-3"
        style={{
          borderColor: `${result.identityColor}40`,
          background: `linear-gradient(135deg, ${result.identityColor}10, transparent)`,
        }}
      >
        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Your Governance Identity
          </p>
          <p className="text-lg font-display font-bold" style={{ color: result.identityColor }}>
            {result.personalityLabel}
          </p>
        </div>
      </motion.div>

      {/* Match cards */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium px-1">
          Top {result.matches.length} matches
        </p>
        {result.matches.slice(0, 5).map((match, idx) => (
          <CompactMatchCard
            key={match.drepId}
            match={match}
            rank={idx + 1}
            expanded={expandedMatch === match.drepId}
            onExpand={() => {
              const newId = expandedMatch === match.drepId ? null : match.drepId;
              onExpandMatch(newId);
              if (newId) {
                onGlobeCommand({ type: 'flyTo', nodeId: match.drepId });
              }
            }}
            userAlignments={result.userAlignments}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <SenecaBubble delay={0}>
          Tap any match to learn more, or view their full profile. You can also start over with
          different answers.
        </SenecaBubble>
        <button
          onClick={onRestart}
          className={cn(
            'w-full rounded-xl border border-white/10 bg-white/5',
            'hover:bg-white/10 px-4 py-2.5 text-xs text-muted-foreground',
            'transition-colors min-h-[44px]',
          )}
        >
          Try different answers
        </button>
      </div>
    </div>
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
        className="w-full text-left px-3 py-2.5 min-h-[44px]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          {/* Rank */}
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: match.identityColor }}
          >
            {rank}
          </span>

          {/* Name + tier */}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm text-foreground truncate block">
              {displayName}
            </span>
            {match.tier && <span className="text-[10px] text-muted-foreground">{match.tier}</span>}
          </div>

          {/* Score */}
          <span
            className="font-display text-xl font-bold tabular-nums shrink-0"
            style={{ color: match.identityColor }}
          >
            {scorePercent}%
          </span>
        </div>

        {/* Agree/differ badges */}
        {(match.agreeDimensions.length > 0 || match.differDimensions.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-1.5 ml-8">
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
              {/* Per-dimension agreement */}
              <DimensionBars userAlignments={userAlignments} matchAlignments={match.alignments} />

              {/* Signature insight */}
              {match.signatureInsight && (
                <p className="text-xs text-muted-foreground italic">{match.signatureInsight}</p>
              )}

              {/* CTAs */}
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
