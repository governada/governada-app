'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuickMatch, type QuickMatchAnswers } from '@/hooks/useQuickMatch';
import { posthog } from '@/lib/posthog';
import Link from 'next/link';

const QUESTIONS = [
  {
    id: 'treasury' as const,
    label: 'Treasury spending?',
    options: [
      { value: 'conservative', label: 'Conservative' },
      { value: 'growth', label: 'Growth' },
      { value: 'balanced', label: 'Balanced' },
    ],
  },
  {
    id: 'protocol' as const,
    label: 'Protocol changes?',
    options: [
      { value: 'caution', label: 'Caution' },
      { value: 'innovation', label: 'Innovation' },
      { value: 'case_by_case', label: 'Case by case' },
    ],
  },
  {
    id: 'transparency' as const,
    label: 'Transparency?',
    options: [
      { value: 'essential', label: 'Essential' },
      { value: 'nice_to_have', label: 'Nice to have' },
      { value: 'doesnt_matter', label: 'Results first' },
    ],
  },
  {
    id: 'decentralization' as const,
    label: 'Power distribution?',
    options: [
      { value: 'spread_widely', label: 'Spread widely' },
      { value: 'concentrated', label: 'Concentrated' },
      { value: 'current_fine', label: 'Current is fine' },
    ],
  },
] as const;

interface MatchPromptPanelProps {
  /** Called with user alignment vector on each answer (for globe highlighting) */
  onAlignmentChange?: (alignments: number[], threshold: number) => void;
  /** Called when match is found (for globe flyToMatch) */
  onMatchFound?: (drepId: string) => void;
  /** Called when panel is closed */
  onClose?: () => void;
}

/**
 * Compact match prompt panel — renders as a translucent sidebar
 * that feels like a search/prompt tool, not an onboarding quiz.
 */
export function MatchPromptPanel({
  onAlignmentChange,
  onMatchFound,
  onClose,
}: MatchPromptPanelProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { state, setAnswer, submit, reset } = useQuickMatch({
    onComplete: (drepResult) => {
      const topMatch = drepResult.matches[0];
      if (topMatch) {
        onMatchFound?.(topMatch.drepId);
      }
    },
  });

  const { answers, isSubmitting, drepResult } = state;
  const hasResult = drepResult !== null;
  const topMatch = drepResult?.matches[0];

  const handleAnswer = (questionId: string, value: string) => {
    setAnswer(questionId, value);
    posthog?.capture('match_panel_answer', { question: questionId, answer: value });

    // Compute alignment vector from answers so far for globe highlighting
    const updatedAnswers = { ...answers, [questionId]: value } as QuickMatchAnswers;
    const alignment = answersToAlignment(updatedAnswers);
    const answeredCount = Object.values(updatedAnswers).filter(Boolean).length;

    // Progressive threshold: 160 → 100 → 60 → 35
    const thresholds = [160, 100, 60, 35];
    const threshold = thresholds[Math.min(answeredCount - 1, thresholds.length - 1)] ?? 160;
    onAlignmentChange?.(alignment, threshold);

    // Auto-advance after short delay
    setTimeout(() => {
      if (currentStep < QUESTIONS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // Last question — submit
        submit(updatedAnswers);
      }
    }, 300);
  };

  const handleReset = () => {
    reset();
    setCurrentStep(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 left-4 z-50 w-72 sm:w-80"
    >
      <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
              {hasResult ? 'Match Found' : 'Find Your Match'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!hasResult && (
              <span className="text-[10px] text-white/40 tabular-nums">
                {currentStep + 1}/{QUESTIONS.length}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="Close match panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <AnimatePresence mode="wait">
            {isSubmitting ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2 py-4"
              >
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <p className="text-xs text-white/50">Scanning the network...</p>
              </motion.div>
            ) : hasResult && topMatch ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {topMatch.drepName || `${topMatch.drepId.slice(0, 16)}...`}
                  </p>
                  <p className="text-xs text-white/50">
                    {topMatch.matchScore}% match &middot; Score {topMatch.drepScore} &middot;{' '}
                    {topMatch.tier ?? 'Emerging'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/drep/${topMatch.drepId}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    View Profile <ArrowRight className="h-3 w-3" />
                  </Link>
                  <button
                    onClick={handleReset}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
                  >
                    Reset
                  </button>
                </div>
                {drepResult && drepResult.matches.length > 1 && (
                  <Link
                    href="/match/result"
                    className="block text-center text-[10px] text-primary/60 hover:text-primary transition-colors"
                  >
                    See all {drepResult.matches.length} matches &rarr;
                  </Link>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={`q-${currentStep}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                <p className="text-sm font-medium text-white/90">{QUESTIONS[currentStep].label}</p>
                <div className="flex flex-col gap-1.5">
                  {QUESTIONS[currentStep].options.map((opt) => {
                    const questionId = QUESTIONS[currentStep].id;
                    const isSelected = answers[questionId] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAnswer(questionId, opt.value)}
                        className={cn(
                          'text-left rounded-lg px-3 py-2 text-xs transition-all',
                          isSelected
                            ? 'bg-primary/20 border border-primary/40 text-white'
                            : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10 hover:text-white/90',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        {!hasResult && !isSubmitting && (
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i === currentStep
                    ? 'w-4 bg-primary'
                    : i < currentStep || answers[QUESTIONS[i].id]
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-white/10',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Convert QuickMatchAnswers to 6D alignment vector for globe highlighting */
function answersToAlignment(answers: QuickMatchAnswers): number[] {
  // [treasuryConservative, treasuryGrowth, security, innovation, transparency, decentralization]
  const vectors: Record<string, Record<string, number[]>> = {
    treasury: {
      conservative: [85, 20, 50, 50, 50, 50],
      growth: [20, 85, 50, 50, 50, 50],
      balanced: [55, 55, 50, 50, 50, 50],
    },
    protocol: {
      caution: [50, 50, 85, 25, 50, 50],
      innovation: [50, 50, 25, 85, 50, 50],
      case_by_case: [50, 50, 55, 55, 50, 50],
    },
    transparency: {
      essential: [50, 50, 50, 50, 90, 70],
      nice_to_have: [50, 50, 50, 50, 55, 50],
      doesnt_matter: [50, 50, 50, 50, 20, 35],
    },
    decentralization: {
      spread_widely: [50, 50, 50, 50, 50, 85],
      concentrated: [50, 50, 50, 50, 50, 20],
      current_fine: [50, 50, 50, 50, 50, 50],
    },
  };

  // Start neutral
  const result = [50, 50, 50, 50, 50, 50];

  for (const [qId, answer] of Object.entries(answers)) {
    if (!answer || !vectors[qId]?.[answer]) continue;
    const vec = vectors[qId][answer];
    for (let i = 0; i < 6; i++) {
      // Average with current (each answer contributes equally)
      if (vec[i] !== 50) {
        result[i] = vec[i];
      }
    }
  }

  return result;
}
