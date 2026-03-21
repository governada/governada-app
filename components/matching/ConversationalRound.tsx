'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PillCloud } from './PillCloud';

/* ─── Types ─────────────────────────────────────────────── */

interface ConversationalRoundProps {
  question: {
    id: string;
    text: string;
    description?: string;
    options: Array<{ id: string; text: string }>;
  };
  roundNumber: number;
  onAnswer: (selectedIds: string[], rawText?: string) => void;
  isLoading?: boolean;
}

/* ─── Placeholder rotation ──────────────────────────────── */

const PLACEHOLDERS = [
  'I care about...',
  'Cardano should prioritize...',
  'The treasury needs...',
  'Good governance means...',
];

function usePlaceholderRotation(intervalMs = 3000): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return PLACEHOLDERS[index];
}

/* ─── Component ─────────────────────────────────────────── */

const MAX_CHARS = 500;

const slideVariants = {
  enter: { x: 60, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -60, opacity: 0 },
};

export function ConversationalRound({
  question,
  roundNumber,
  onAnswer,
  isLoading = false,
}: ConversationalRoundProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rawText, setRawText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholder = usePlaceholderRotation();

  const canContinue = selected.size >= 1 || rawText.trim().length >= 10;

  const handleToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setRawText(value);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canContinue || isLoading) return;
    const trimmed = rawText.trim();
    onAnswer(Array.from(selected), trimmed.length > 0 ? trimmed : undefined);
  }, [canContinue, isLoading, rawText, selected, onAnswer]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [rawText]);

  // Reset state when question changes
  useEffect(() => {
    setSelected(new Set());
    setRawText('');
  }, [question.id]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="w-full"
      >
        {/* Question text */}
        <div className="mb-6">
          <h2 className="text-lg font-medium md:text-xl">{question.text}</h2>
          {question.description && (
            <p className="mt-1 text-sm text-muted-foreground">{question.description}</p>
          )}
        </div>

        {/* Pill cloud */}
        <div className="mb-6">
          <PillCloud
            pills={question.options}
            selected={selected}
            onToggle={handleToggle}
            multiSelect
            disabled={isLoading}
          />
        </div>

        {/* Divider */}
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-muted-foreground">— or describe in your own words —</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Freeform text area */}
        <div className="mb-6">
          <textarea
            ref={textareaRef}
            value={rawText}
            onChange={handleTextChange}
            placeholder={placeholder}
            disabled={isLoading}
            rows={3}
            className={cn(
              'w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3',
              'text-sm text-foreground placeholder:text-muted-foreground/50',
              'backdrop-blur-sm transition-colors',
              'focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
          <div className="mt-1 flex justify-between">
            {rawText.trim().length >= 10 ? (
              <span className="text-xs text-primary/60">AI will analyze your response</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Optional — share your thoughts in your own words
              </span>
            )}
            <span
              className={cn(
                'text-xs text-muted-foreground text-right',
                rawText.length > MAX_CHARS * 0.9 && 'text-amber-500',
              )}
            >
              {rawText.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {/* Continue button */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Round {roundNumber}</span>
          <Button onClick={handleSubmit} disabled={!canContinue || isLoading} size="default">
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
