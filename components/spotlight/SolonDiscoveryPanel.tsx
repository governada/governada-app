'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ScrollText, Send, X, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import { useAdvisor } from '@/hooks/useAdvisor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SolonSuggestedPrompts } from './SolonSuggestedPrompts';
import type { SpotlightEntityType } from './types';

// ─── Seneca's Voice ───────────────────────────────────────────────────────────

const SENECA_TOOLTIP =
  'Inspired by Seneca the Younger (c.\u00A04\u00A0BC\u2013AD\u00A065) \u2014 Stoic philosopher, statesman, and advisor whose letters on wisdom and governance remain influential two millennia later.';

const SENECA_GREETINGS: Record<SpotlightEntityType, string> = {
  drep: '"It is not that we have a short time to live, but that we waste a great deal of it." There are representatives below who take governance seriously — and others who registered and vanished. Ask me anything.',
  spo: 'The pools below don\u2019t just produce blocks \u2014 some also vote on the future of the protocol. Worth knowing which ones show up. Ask me what you want to know.',
  proposal:
    'Every proposal below will shape Cardano for years. Some allocate millions from the treasury. Others change the protocol itself. Ask me about any of them.',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface SenecaDiscoveryPanelProps {
  entityType: SpotlightEntityType;
  entityCount: number;
  onQueryResults?: (query: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SolonDiscoveryPanel({
  entityType,
  entityCount,
  onQueryResults,
}: SenecaDiscoveryPanelProps) {
  const reducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, isStreaming, error, clearMessages } = useAdvisor({
    pageContext: `spotlight_discovery_${entityType}`,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setInputValue('');
    setIsExpanded(true);
    onQueryResults?.(trimmed);
  }, [inputValue, isStreaming, sendMessage, onQueryResults]);

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
      setIsExpanded(true);
      onQueryResults?.(prompt);
    },
    [sendMessage, onQueryResults],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClear = useCallback(() => {
    clearMessages();
    setIsExpanded(false);
  }, [clearMessages]);

  const hasMessages = messages.length > 0;

  return (
    <motion.div
      className="overflow-hidden rounded-xl border border-border/50 bg-card/70 backdrop-blur-md"
      variants={reducedMotion ? undefined : fadeInUp}
      initial={reducedMotion ? undefined : 'hidden'}
      animate="visible"
    >
      {/* Seneca header */}
      <div className="space-y-3 px-5 pb-2 pt-5 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ScrollText className="h-3.5 w-3.5 text-primary" />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Seneca
                  <Info className="h-3 w-3 text-muted-foreground/40" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4} className="max-w-[260px]">
                {SENECA_TOOLTIP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {hasMessages && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Seneca's greeting — italic, Stoic voice */}
        {!hasMessages && (
          <p className="text-sm italic leading-relaxed text-muted-foreground">
            {SENECA_GREETINGS[entityType]}
          </p>
        )}
      </div>

      {/* Suggested prompts (only when no messages) */}
      {!hasMessages && (
        <div className="border-t border-border/10 px-5 py-3 sm:px-6">
          <SolonSuggestedPrompts entityType={entityType} onSelect={handlePromptSelect} />
        </div>
      )}

      {/* Conversation messages */}
      <AnimatePresence>
        {isExpanded && hasMessages && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="max-h-60 space-y-3 overflow-y-auto border-t border-border/10 px-5 py-3 sm:px-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-sm',
                    msg.role === 'user' ? 'text-right text-primary/90' : 'text-muted-foreground',
                  )}
                >
                  {msg.role === 'user' ? (
                    <span className="inline-block rounded-lg bg-primary/10 px-3 py-1.5">
                      {msg.content}
                    </span>
                  ) : (
                    <span className="italic">
                      {msg.content}
                      {isStreaming && i === messages.length - 1 && (
                        <span className="ml-1 inline-flex gap-0.5">
                          <span className="animate-pulse">·</span>
                          <span className="animate-pulse" style={{ animationDelay: '0.15s' }}>
                            ·
                          </span>
                          <span className="animate-pulse" style={{ animationDelay: '0.3s' }}>
                            ·
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex justify-end border-t border-border/10 px-5 py-2 sm:px-6">
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input — "Ask Seneca" */}
      <div className="flex items-center gap-2 border-t border-border/10 px-5 py-2.5 sm:px-6">
        <ScrollText className="h-3.5 w-3.5 shrink-0 text-primary/40" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Seneca anything\u2026"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isStreaming}
          className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20 disabled:opacity-30"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {error && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-2 text-xs text-red-400 sm:px-6">
          {error}
        </div>
      )}
    </motion.div>
  );
}
