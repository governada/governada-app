'use client';

/**
 * SenecaResearch — Deep Research panel UI (Tier 3).
 *
 * Displays a multi-step research progress stepper with real-time status,
 * collapsible step summaries, and a streamed final synthesis.
 *
 * Feature-flagged behind `seneca_deep_research`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
} from 'lucide-react';
import { AIResponse } from '@/components/commandpalette/AIResponse';
import { getStoredSession } from '@/lib/supabaseAuth';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SenecaResearchProps {
  question: string;
  onBack: () => void;
}

interface StepState {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  summary?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SenecaResearch({ question, onBack }: SenecaResearchProps) {
  const prefersReducedMotion = useReducedMotion();
  const [steps, setSteps] = useState<StepState[]>([]);
  const [synthesis, setSynthesis] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [startTime] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Timer
  useEffect(() => {
    if (isDone) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isDone, startTime]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, synthesis, isSynthesizing]);

  // Execute research
  useEffect(() => {
    const abort = new AbortController();
    abortRef.current = abort;

    async function run() {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        const token = getStoredSession();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/intelligence/research', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            question,
            context: {},
          }),
          signal: abort.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          setError(err.error ?? `Request failed (${res.status})`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError('No response stream available');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;

              switch (data.type) {
                case 'plan':
                  setSteps(
                    (data.steps as Array<{ id: string; label: string }>).map((s) => ({
                      ...s,
                      status: 'pending' as const,
                    })),
                  );
                  break;

                case 'step_start':
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.id === data.stepId ? { ...s, status: 'running' as const } : s,
                    ),
                  );
                  if (data.stepId === 'synthesize') {
                    setIsSynthesizing(true);
                  }
                  break;

                case 'step_done':
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.id === data.stepId
                        ? { ...s, status: 'done' as const, summary: data.summary as string }
                        : s,
                    ),
                  );
                  if (data.stepId === 'synthesize') {
                    setIsSynthesizing(false);
                  }
                  break;

                case 'step_error':
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.id === data.stepId ? { ...s, status: 'error' as const } : s,
                    ),
                  );
                  break;

                case 'synthesis':
                  setSynthesis((prev) => prev + (data.content as string));
                  break;

                case 'done':
                  setIsDone(true);
                  setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
                  break;
              }
            } catch {
              // Skip malformed SSE events
            }
          }
        }

        if (!isDone) {
          setIsDone(true);
          setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
        }
      } catch (err) {
        if (abort.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    }

    run();

    return () => {
      abort.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col flex-1 min-h-0"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/10 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'flex items-center gap-1 text-xs text-muted-foreground/60',
            'hover:text-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm',
          )}
          aria-label="Back to conversation"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Back</span>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <Search className="h-3 w-3 text-primary/70" />
          <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">
            Deep Research
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent px-3 py-3 space-y-3"
      >
        {/* Question */}
        <div className="flex justify-end">
          <div
            className={cn(
              'max-w-[85%] px-3 py-1.5 rounded-2xl rounded-br-sm',
              'bg-primary/15 text-foreground/90 text-sm leading-relaxed',
            )}
          >
            {question}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step stepper */}
        {steps.length > 0 && (
          <div className="space-y-1">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                isExpanded={expandedSteps.has(step.id)}
                onToggle={() => toggleStep(step.id)}
              />
            ))}
          </div>
        )}

        {/* Synthesis */}
        {(synthesis || isSynthesizing) && (
          <div className="border-t border-border/10 pt-3">
            <AIResponse content={synthesis} isStreaming={isSynthesizing} />
          </div>
        )}

        {/* Timing badge */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-1.5 pt-2"
            >
              <Clock className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50">
                Researched in {elapsedSeconds}s
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step row component
// ---------------------------------------------------------------------------

function StepRow({
  step,
  isExpanded,
  onToggle,
}: {
  step: StepState;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={cn('rounded-lg transition-colors', step.status === 'running' && 'bg-primary/5')}
    >
      <button
        type="button"
        onClick={step.summary ? onToggle : undefined}
        disabled={!step.summary}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 text-left',
          step.summary && 'cursor-pointer hover:bg-muted/30',
          !step.summary && 'cursor-default',
        )}
        aria-expanded={isExpanded}
      >
        {/* Status icon */}
        <div className="shrink-0 w-5 h-5 flex items-center justify-center">
          {step.status === 'pending' && (
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          )}
          {step.status === 'running' && (
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          )}
          {step.status === 'done' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
          {step.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
        </div>

        {/* Label */}
        <span
          className={cn(
            'flex-1 text-xs',
            step.status === 'pending' && 'text-muted-foreground/50',
            step.status === 'running' && 'text-foreground font-medium',
            step.status === 'done' && 'text-foreground/70',
            step.status === 'error' && 'text-destructive/70',
          )}
        >
          {step.label}
        </span>

        {/* Expand chevron */}
        {step.summary && (
          <div className="shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
            )}
          </div>
        )}
      </button>

      {/* Expanded summary */}
      <AnimatePresence>
        {isExpanded && step.summary && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="text-xs text-muted-foreground leading-relaxed px-9 pb-2">
              {step.summary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
