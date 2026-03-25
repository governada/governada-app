'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Compass, Send } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface SenecaDockProps {
  onStartConversation: (query: string) => void;
  onStartMatch?: () => void;
  narrativePulse?: string;
}

const GHOST_PROMPTS = [
  'Who should represent my ADA?',
  "What's happening in governance right now?",
  'How does Cardano governance work?',
  'Which proposals are being voted on?',
  'What do DReps actually do?',
  'How is the treasury being spent?',
];

// Show 3 prompts at a time, rotate every 10 seconds
const VISIBLE_COUNT = 3;
const ROTATE_INTERVAL = 10_000;

/**
 * SenecaDock — Compact bottom-left Seneca entry point for the anonymous homepage.
 *
 * Glassmorphic card with rotating ghost prompts and a text input.
 * The primary entry point into the Seneca AI companion.
 */
/** The first ghost prompt triggers match mode instead of conversation */
const MATCH_PROMPT = GHOST_PROMPTS[0]; // "Who should represent my ADA?"

export function SenecaDock({ onStartConversation, onStartMatch, narrativePulse }: SenecaDockProps) {
  const [inputValue, setInputValue] = useState('');
  const [promptOffset, setPromptOffset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Rotate ghost prompts every 10 seconds
  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = setInterval(() => {
      setPromptOffset((prev) => (prev + VISIBLE_COUNT) % GHOST_PROMPTS.length);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [prefersReducedMotion]);

  const visiblePrompts = Array.from({ length: VISIBLE_COUNT }, (_, i) => {
    const idx = (promptOffset + i) % GHOST_PROMPTS.length;
    return GHOST_PROMPTS[idx];
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const query = inputValue.trim();
      if (!query) return;
      onStartConversation(query);
      setInputValue('');
    },
    [inputValue, onStartConversation],
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      if (prompt === MATCH_PROMPT && onStartMatch) {
        onStartMatch();
      } else {
        onStartConversation(prompt);
      }
    },
    [onStartConversation, onStartMatch],
  );

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:left-4 lg:left-16 sm:w-80 z-40 pointer-events-auto"
    >
      <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Narrative pulse */}
        {narrativePulse && (
          <div className="px-4 pt-3 pb-0">
            <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{narrativePulse}</p>
          </div>
        )}

        {/* Header with Seneca sigil */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <motion.div
            animate={prefersReducedMotion ? {} : { opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Compass className="h-4 w-4 text-primary" />
          </motion.div>
          <span
            className="text-sm font-semibold text-white/90"
            style={{ fontFamily: 'var(--font-governada-display)' }}
          >
            Ask Seneca
          </span>
        </div>

        {/* Ghost prompts */}
        <div className="px-4 pb-2 space-y-1 min-h-[4.5rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={promptOffset}
              initial={prefersReducedMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? {} : { opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-1"
            >
              {visiblePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  className="block w-full text-left text-xs text-white/50 hover:text-white/80 transition-colors py-0.5 cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything about governance..."
              className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="shrink-0 text-white/40 hover:text-primary disabled:opacity-30 transition-colors"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
