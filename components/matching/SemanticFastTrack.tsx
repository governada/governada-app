'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface SemanticFastTrackProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
  className?: string;
}

/* ─── Example prompts ───────────────────────────────────── */

const EXAMPLE_PROMPTS = [
  'I believe the treasury should prioritize developer tooling',
  'DReps should be transparent about every vote',
  'Cardano needs to move faster on protocol upgrades',
  'Security and stability matter more than speed',
] as const;

const MAX_CHARS = 500;
const MIN_CHARS = 20;

/* ─── Rotating example prompt ──────────────────────────── */

function useRotatingPrompt(intervalMs = 4000): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % EXAMPLE_PROMPTS.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return index;
}

/* ─── Component ─────────────────────────────────────────── */

export function SemanticFastTrack({ onSubmit, isProcessing, className }: SemanticFastTrackProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activePromptIndex = useRotatingPrompt();
  const prefersReducedMotion = useReducedMotion();

  const canSubmit = text.trim().length >= MIN_CHARS && !isProcessing;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setText(value);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(text.trim());
  }, [canSubmit, onSubmit, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [canSubmit, handleSubmit],
  );

  const handleExampleClick = useCallback((prompt: string) => {
    setText(prompt);
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [text]);

  return (
    <div
      className={cn('rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm', className)}
    >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Tell us what matters to you in Cardano governance..."
        aria-label="Tell us what matters to you in Cardano governance"
        disabled={isProcessing}
        rows={4}
        className={cn(
          'w-full resize-none rounded-lg border-0 bg-transparent px-0 py-1',
          'text-sm text-foreground placeholder:text-muted-foreground/50',
          'transition-colors',
          'focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />

      {/* Character count */}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {text.trim().length < MIN_CHARS && text.length > 0
            ? `${MIN_CHARS - text.trim().length} more characters needed`
            : '\u00A0'}
        </span>
        <span
          className={cn(
            'text-xs text-muted-foreground',
            text.length > MAX_CHARS * 0.9 && 'text-amber-500',
          )}
        >
          {text.length}/{MAX_CHARS}
        </span>
      </div>

      {/* Processing state */}
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground animate-pulse">
              Analyzing your governance values...
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 space-y-3"
          >
            {/* Example prompts */}
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(prompt)}
                  aria-label={`Use example: ${prompt}`}
                  className={cn(
                    'rounded-full border border-white/10 px-3 py-1',
                    'text-xs text-muted-foreground transition-colors',
                    'hover:border-primary/30 hover:text-foreground',
                    i === activePromptIndex && 'border-primary/20 text-foreground/70',
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Submit button */}
            <AnimatePresence>
              {text.trim().length >= MIN_CHARS && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-2">
                    Find my matches
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
