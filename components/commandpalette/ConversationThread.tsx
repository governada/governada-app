'use client';

/**
 * ConversationThread — manages multi-turn conversation with the governance advisor.
 *
 * Renders a scrollable thread of user messages and AI responses,
 * supports follow-up questions, and manages streaming state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, X } from 'lucide-react';
import { AIResponse } from './AIResponse';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useSegment } from '@/components/providers/SegmentProvider';
import { readAdvisorStream } from '@/lib/intelligence/streamAdvisor';
import type { AdvisorMessage } from '@/lib/intelligence/streamAdvisor';
import { cn } from '@/lib/utils';

export interface ConversationThreadProps {
  /** The initial question that triggered conversational mode */
  initialQuery: string;
  /** Callback to exit conversational mode */
  onExit: () => void;
  /** Callback to close the entire palette */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// ConversationThread component
// ---------------------------------------------------------------------------

type Message = AdvisorMessage;

export function ConversationThread({
  initialQuery,
  onExit,
  onClose: _onClose,
}: ConversationThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamContentRef = useRef('');

  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const { segment } = useSegment();

  const daysRemaining = totalDays - day;

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Send a message to the advisor
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
      };

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsStreaming(true);
      setStreamError(null);
      streamContentRef.current = '';

      // Build conversation history for API
      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const abort = new AbortController();
      abortRef.current = abort;

      readAdvisorStream(
        allMessages,
        {
          epoch,
          daysRemaining,
          activeProposalCount: activeProposalCount ?? 0,
          segment,
        },
        // onDelta
        (delta) => {
          streamContentRef.current += delta;
          const currentContent = streamContentRef.current;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: currentContent };
            }
            return updated;
          });
        },
        // onError
        (error) => {
          setStreamError(error);
          setIsStreaming(false);
        },
        // onDone
        () => {
          setIsStreaming(false);
        },
        abort.signal,
      );
    },
    [messages, isStreaming, epoch, daysRemaining, activeProposalCount, segment],
  );

  // Send initial query on mount
  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      sendMessage(initialQuery);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Handle follow-up submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isStreaming) {
        abortRef.current?.abort();
        setIsStreaming(false);
      } else {
        onExit();
      }
    }
  };

  // Retry last failed message
  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove the failed assistant message
      setMessages((prev) => prev.slice(0, -1));
      setStreamError(null);
      sendMessage(lastUserMsg.content);
    }
  };

  return (
    <div className="flex flex-col" onKeyDown={handleKeyDown}>
      {/* Thread header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <span className="text-[11px] text-muted-foreground font-medium">Governance Advisor</span>
        <div className="flex items-center gap-1">
          {streamError && (
            <button
              onClick={handleRetry}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Retry"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={onExit}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Back to search"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-[360px] overflow-y-auto">
        {messages.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div
                key={msg.id}
                className="px-3 py-2 text-sm text-foreground bg-muted/20 border-b border-border/20"
              >
                {msg.content}
              </div>
            );
          }

          const isLast = idx === messages.length - 1;
          return (
            <AIResponse
              key={msg.id}
              content={msg.content}
              isStreaming={isLast && isStreaming}
              error={isLast ? (streamError ?? undefined) : undefined}
            />
          );
        })}
      </div>

      {/* Follow-up input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border/50 px-3 py-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isStreaming ? 'Waiting for response...' : 'Ask a follow-up...'}
          disabled={isStreaming}
          className={cn(
            'flex-1 bg-transparent text-sm outline-none',
            'placeholder:text-muted-foreground/60',
            'disabled:opacity-50',
          )}
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            'disabled:opacity-30 disabled:cursor-not-allowed',
          )}
          title="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
