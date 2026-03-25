'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ScrollText, Send, X, ChevronDown, ChevronUp, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import { useAdvisor } from '@/hooks/useAdvisor';
import { useSegment } from '@/components/providers/SegmentProvider';
import { SolonSuggestedPrompts } from './SolonSuggestedPrompts';
import type { SpotlightEntityType } from './types';

// ─── Seneca's Voice ───────────────────────────────────────────────────────────

const SENECA_PLACEHOLDERS: Record<SpotlightEntityType, string> = {
  drep: 'Ask about any representative...',
  spo: 'Ask about any pool...',
  proposal: 'Ask about any proposal...',
};

const SENECA_GREETINGS: Record<SpotlightEntityType, string> = {
  drep: '"It is not that we have a short time to live, but that we waste a great deal of it." Below are those who claimed the mantle of representative. Some have earned it through consistent action. Others registered and vanished. Ask me who deserves your trust.',
  spo: 'These pools do not merely produce blocks \u2014 some also cast votes that shape the protocol\u2019s future. Your staking choice is a governance choice, whether you intended it or not. Ask me which ones take that duty seriously.',
  proposal:
    'Every proposal below carries consequence that will outlast the epoch in which it was written. Some redistribute the common treasury. Others alter the rules themselves. Ask me about any of them \u2014 I will tell you what the numbers cannot.',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface SenecaDiscoveryPanelProps {
  entityType: SpotlightEntityType;
  entityCount: number;
  onQueryResults?: (query: string) => void;
}

// ─── Anonymous prompt → filter redirect map ──────────────────────────────────

const ANONYMOUS_PROMPT_REDIRECTS: Record<SpotlightEntityType, Record<string, string>> = {
  drep: {
    'Who votes on every proposal?': '/governance/representatives',
    'DReps focused on developer funding': '/governance/representatives',
    'Most active newcomers': '/governance/representatives',
    'Representatives who explain their votes': '/governance/representatives',
  },
  spo: {
    'Most active governance pools': '/governance/pools',
    'Pools with strong deliberation': '/governance/pools',
    'Large pools that participate in governance': '/governance/pools',
    'Pools focused on decentralization': '/governance/pools',
  },
  proposal: {
    "What's being decided right now?": '/governance/proposals?status=Open',
    'Treasury spending proposals': '/governance/proposals?status=Open&type=Treasury',
    'Most contested proposals': '/governance/proposals?status=Open',
    'Proposals closing soon': '/governance/proposals?status=Open',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SolonDiscoveryPanel({
  entityType,
  entityCount: _entityCount,
  onQueryResults,
}: SenecaDiscoveryPanelProps) {
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const { segment } = useSegment();
  const isAnonymous = segment === 'anonymous';
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
      // Anonymous users: redirect to relevant filtered page instead of AI advisor
      if (isAnonymous) {
        const redirectMap = ANONYMOUS_PROMPT_REDIRECTS[entityType];
        const href = redirectMap?.[prompt];
        if (href) {
          router.push(href);
          return;
        }
        // Fallback: navigate to the entity listing page
        const fallbackRoutes: Record<SpotlightEntityType, string> = {
          drep: '/governance/representatives',
          spo: '/governance/pools',
          proposal: '/governance/proposals',
        };
        router.push(fallbackRoutes[entityType]);
        return;
      }
      sendMessage(prompt);
      setIsExpanded(true);
      onQueryResults?.(prompt);
    },
    [isAnonymous, entityType, router, sendMessage, onQueryResults],
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
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Seneca
          </span>

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
        {isAnonymous ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        ) : (
          <ScrollText className="h-3.5 w-3.5 shrink-0 text-primary/40" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={isAnonymous ? '' : inputValue}
          onChange={(e) => !isAnonymous && setInputValue(e.target.value)}
          onKeyDown={isAnonymous ? undefined : handleKeyDown}
          placeholder={
            isAnonymous ? 'Connect wallet to ask Seneca' : SENECA_PLACEHOLDERS[entityType]
          }
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed"
          disabled={isStreaming || isAnonymous}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isStreaming || isAnonymous}
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
