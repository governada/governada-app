'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useFeatureFlag } from '@/components/FeatureGate';
import { Sparkles, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdvisor, getRemainingMessages } from '@/hooks/useAdvisor';
import { AdvisorTeaser } from './AdvisorTeaser';

const MAX_MESSAGES_PER_DAY = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdvisorPanelProps {
  /** Page-specific context string */
  pageContext?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Streaming indicator (pulsing dots)
// ---------------------------------------------------------------------------

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Thinking">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdvisorPanel({ pageContext, className }: AdvisorPanelProps) {
  const { segment } = useSegment();
  const advisorEnabled = useFeatureFlag('conversational_nav');
  const { messages, sendMessage, isStreaming, error, clearMessages } = useAdvisor({ pageContext });

  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [remaining, setRemaining] = useState(getRemainingMessages);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Expand on first message
  useEffect(() => {
    if (messages.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [messages.length, isExpanded]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Update remaining count after sending
  useEffect(() => {
    setRemaining(getRemainingMessages());
  }, [messages.length]);

  // --- Gate: show teaser for anonymous users or when feature is disabled ---
  if (segment === 'anonymous' || advisorEnabled === false) {
    return <AdvisorTeaser className={className} />;
  }

  // While feature flag is loading (null), render nothing to avoid flash
  if (advisorEnabled === null) {
    return null;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    setInputValue('');
  }

  function handleToggle() {
    if (messages.length > 0) {
      setIsExpanded((prev) => !prev);
    }
  }

  function handleClear() {
    clearMessages();
    setIsExpanded(false);
    setInputValue('');
    inputRef.current?.focus();
  }

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-border/50 bg-card/70 backdrop-blur-md',
        className,
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-2.5',
          messages.length > 0 && 'cursor-pointer hover:bg-muted/30',
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-teal-400" />
        <span className="flex-1 text-left text-sm font-medium">Governance Advisor</span>
        <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-400">
          Beta
        </span>
        {messages.length > 0 &&
          (isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
          ))}
      </button>

      {/* Messages area (when expanded) */}
      {isExpanded && messages.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto border-t border-border/30 px-4 py-3">
          <div className="flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                    msg.role === 'user' ? 'bg-teal-600 text-white' : 'bg-muted/50 text-foreground',
                  )}
                >
                  {msg.content ||
                    (isStreaming && idx === messages.length - 1 ? <StreamingDots /> : null)}
                  {msg.role === 'assistant' &&
                    msg.content.length > 0 &&
                    isStreaming &&
                    idx === messages.length - 1 && (
                      <span className="ml-1 inline-block">
                        <StreamingDots />
                      </span>
                    )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Clear conversation */}
          {messages.length >= 2 && !isStreaming && (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Clear conversation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="border-t border-border/30 px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5',
          (isExpanded || error) && 'border-t border-border/30',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask any governance question..."
          disabled={isStreaming}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isStreaming}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
            inputValue.trim() && !isStreaming
              ? 'bg-teal-600 text-white hover:bg-teal-500'
              : 'bg-muted/50 text-muted-foreground/40',
          )}
          aria-label="Send message"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Rate limit footer */}
      <div className="px-4 pb-2">
        <p className="text-[10px] text-muted-foreground/50">
          {remaining}/{MAX_MESSAGES_PER_DAY} questions remaining today
        </p>
      </div>
    </div>
  );
}
