'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NarrativeIntroProps {
  onComplete: () => void;
  briefingData: {
    proposalsDecided?: number;
    drepVotesCast?: number;
    treasuryBalance?: string;
    ghiScore?: number;
    ghiTrend?: 'up' | 'down' | 'flat';
    pendingCount?: number;
    drepName?: string;
  } | null;
}

interface NarrativeStep {
  text: string;
  duration: number;
  type: 'proposals' | 'drep' | 'treasury' | 'health' | 'action' | 'fade-out';
}

function buildSteps(data: NonNullable<NarrativeIntroProps['briefingData']>): NarrativeStep[] {
  const steps: NarrativeStep[] = [];

  if (data.proposalsDecided && data.proposalsDecided > 0) {
    steps.push({
      text: `<strong>${data.proposalsDecided} proposal${data.proposalsDecided === 1 ? '' : 's'}</strong> decided since your last visit.`,
      duration: 3000,
      type: 'proposals',
    });
  }

  if (data.drepName) {
    const votesText =
      data.drepVotesCast !== undefined
        ? ` cast ${data.drepVotesCast} vote${data.drepVotesCast === 1 ? '' : 's'} this epoch`
        : '';
    steps.push({
      text: `Your DRep <strong>${data.drepName}</strong>${votesText}.`,
      duration: 3000,
      type: 'drep',
    });
  }

  if (data.treasuryBalance) {
    steps.push({
      text: `Treasury stands at <strong>${data.treasuryBalance}</strong>.`,
      duration: 3000,
      type: 'treasury',
    });
  }

  if (data.ghiScore !== undefined) {
    const trendDesc =
      data.ghiTrend === 'up'
        ? 'trending upward'
        : data.ghiTrend === 'down'
          ? 'trending downward'
          : 'holding steady';
    steps.push({
      text: `Governance health: <strong>${data.ghiScore}</strong> \u2014 ${trendDesc}.`,
      duration: 3000,
      type: 'health',
    });
  }

  if (data.pendingCount && data.pendingCount > 0) {
    steps.push({
      text: `<strong>${data.pendingCount} proposal${data.pendingCount === 1 ? '' : 's'}</strong> await${data.pendingCount === 1 ? 's' : ''} attention.`,
      duration: 3000,
      type: 'action',
    });
  }

  // Always end with a fade-out step
  steps.push({ text: '', duration: 1000, type: 'fade-out' });

  return steps;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

export function NarrativeIntro({ onComplete, briefingData }: NarrativeIntroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const steps = useMemo(() => {
    if (!briefingData) return [];
    return buildSteps(briefingData);
  }, [briefingData]);

  const finish = useCallback(() => {
    setCompleted((prev) => {
      if (prev) return prev;
      onComplete();
      return true;
    });
  }, [onComplete]);

  // No data or empty steps -> complete immediately
  useEffect(() => {
    if (steps.length === 0 || (steps.length === 1 && steps[0].type === 'fade-out')) {
      finish();
    }
  }, [steps, finish]);

  // Reduced motion: skip to end
  useEffect(() => {
    if (reducedMotion && steps.length > 0) {
      const timeout = setTimeout(finish, 500);
      return () => clearTimeout(timeout);
    }
  }, [reducedMotion, steps.length, finish]);

  // Advance through steps
  useEffect(() => {
    if (reducedMotion || steps.length === 0 || completed) return;

    const step = steps[currentIndex];
    if (!step) {
      finish();
      return;
    }

    timerRef.current = setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= steps.length) {
        finish();
      } else {
        setCurrentIndex(nextIndex);
      }
    }, step.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, steps, reducedMotion, finish]);

  if (steps.length === 0 || completed || reducedMotion) {
    return null;
  }

  const currentStep = steps[currentIndex];
  if (!currentStep || currentStep.type === 'fade-out') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[20] flex items-center justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="max-w-md rounded-2xl bg-[oklch(0.15_0.01_260/0.7)] backdrop-blur-xl px-8 py-6 text-center"
        >
          <p
            className="text-lg sm:text-xl text-foreground/70 leading-relaxed [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: currentStep.text }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
